import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { db, UserDoc, UserRole } from '../database/db.js';

function resolveRoleFromDiscord(discordRoles: string[]): UserRole {
  if (ENV.ROLE_ID_ADMIN && discordRoles.includes(ENV.ROLE_ID_ADMIN)) {
    return 'ADMIN';
  }
  if (ENV.ROLE_ID_GM && discordRoles.includes(ENV.ROLE_ID_GM)) {
    return 'GM';
  }
  return 'PILOT';
}

function createToken(user: UserDoc): string {
  return jwt.sign(
    {
      userId: user._id,
      discord_id: user.discord_id,
      name: user.name,
      role: user.role
    },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export const AuthController = {
  // 1. Gera a URL oficial de autorização do Discord OAuth2
  getDiscordAuthUrl(req: Request, res: Response) {
    if (!ENV.DISCORD_CLIENT_ID) {
      return res.status(500).json({
        error: 'DISCORD_NOT_CONFIGURED',
        message: 'DISCORD_CLIENT_ID não está configurado no servidor.'
      });
    }

    const scope = encodeURIComponent('identify email guilds.members.read');
    const redirectUri = encodeURIComponent(ENV.DISCORD_REDIRECT_URI);
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${ENV.DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;

    if (req.query.redirect === 'true') {
      return res.redirect(authUrl);
    }

    return res.json({ auth_url: authUrl });
  },

  // 2. Processa o retorno do Discord (Callback) com o código de autorização
  async handleDiscordCallback(req: Request, res: Response) {
    const { code, error, error_description } = req.query;

    if (error) {
      console.error('[!] Erro retornado pelo Discord OAuth2:', error, error_description);
      return res.redirect(`${ENV.CLIENT_URL}/auth/callback?error=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${ENV.CLIENT_URL}/auth/callback?error=NO_CODE_PROVIDED`);
    }

    try {
      // Passo A: Troca o código pelo token de acesso do Discord
      const tokenParams = new URLSearchParams({
        client_id: ENV.DISCORD_CLIENT_ID,
        client_secret: ENV.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: ENV.DISCORD_REDIRECT_URI
      });

      const tokenResponse = await axios.post(
        'https://discord.com/api/v10/oauth2/token',
        tokenParams.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token } = tokenResponse.data;

      // Passo B: Consulta os dados do perfil do usuário no Discord
      const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      const discordUser = userResponse.data;
      const discordId = discordUser.id;
      const name = discordUser.global_name || discordUser.username;
      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0', 10) % 5}.png`;

      // Passo B.2: Consulta os cargos e apelido do operador no servidor da guilda
      let discordRoles: string[] = [];
      let nickname: string | undefined;

      if (ENV.DISCORD_GUILD_ID) {
        try {
          const memberResponse = await axios.get(
            `https://discord.com/api/v10/users/@me/guilds/${ENV.DISCORD_GUILD_ID}/member`,
            {
              headers: { Authorization: `Bearer ${access_token}` }
            }
          );
          discordRoles = memberResponse.data.roles || [];
          nickname = memberResponse.data.nick || undefined;
          console.log(`[+] Cargos do operador @${discordUser.username} na guilda (${ENV.DISCORD_GUILD_ID}):`, discordRoles);
        } catch (err: any) {
          console.warn(`[!] Não foi possível ler cargos no servidor ${ENV.DISCORD_GUILD_ID}:`, err.response?.data?.message || err.message);
        }
      }

      // Passo C: Localiza ou cadastra o usuário no banco de dados NoSQL
      const computedRole = resolveRoleFromDiscord(discordRoles);
      let user = db.users.findByDiscordId(discordId);

      if (!user) {
        // Primeiro acesso: cadastra com a role mapeada dos cargos do Discord
        user = db.users.create({
          discord_id: discordId,
          name: name,
          username: discordUser.username,
          nickname: nickname,
          email: discordUser.email,
          avatar: avatarUrl,
          discord_roles: discordRoles,
          role: computedRole
        });
        console.log(`[+] Novo operador cadastrado via Discord: @${user.username} [${user.role}] (ID: ${user.discord_id})`);
      } else {
        // Atualiza avatar, nome, cargos e sincroniza role do Discord
        let nextRole = user.role;
        if (computedRole === 'ADMIN' || computedRole === 'GM') {
          nextRole = computedRole;
        } else if (user.role !== 'PENDING_GM') {
          nextRole = computedRole;
        }

        user = db.users.update(user._id, {
          name: name,
          username: discordUser.username,
          nickname: nickname,
          avatar: avatarUrl,
          discord_roles: discordRoles,
          role: nextRole
        })!;
        console.log(`[+] Operador reconectado via Discord: @${user.username} [${user.role}]`);
      }

      // Passo D: Gera o JWT de sessão da aplicação
      const token = createToken(user);

      // Define cookie seguro
      res.cookie('omninet_token', token, {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      // Redireciona para o frontend com o token
      return res.redirect(`${ENV.CLIENT_URL}/auth/callback?token=${token}`);
    } catch (err: any) {
      console.error('[!] Falha na troca de credenciais do Discord:', err.response?.data || err.message);
      return res.redirect(`${ENV.CLIENT_URL}/auth/callback?error=AUTH_EXCHANGE_FAILED`);
    }
  },

  // 3. Retorna os dados do usuário autenticado atual
  async getMe(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const pilot = db.pilots.findByUserId(req.user._id);

    return res.json({
      user: req.user,
      pilot: pilot || null
    });
  },

  // 4. Encerra a sessão
  logout(req: Request, res: Response) {
    res.clearCookie('omninet_token');
    return res.json({ message: '[+] Sessão de terminal encerrada.' });
  }
};
