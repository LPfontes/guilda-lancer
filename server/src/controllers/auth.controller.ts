import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { UserModel, PilotModel, IUser, UserRole } from '../database/db.js';

function resolveRoleFromDiscord(discordRoles: string[]): UserRole {
  if (ENV.ROLE_ID_ADMIN && discordRoles.includes(ENV.ROLE_ID_ADMIN)) {
    return 'ADMIN';
  }
  if (ENV.ROLE_ID_GM && discordRoles.includes(ENV.ROLE_ID_GM)) {
    return 'GM';
  }
  return 'PILOT';
}

function createToken(user: IUser): string {
  return jwt.sign(
    {
      userId: user._id.toString(),
      discord_id: user.discord_id,
      name: user.name,
      role: user.role
    },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function getClientCallbackUrl(pathAndQuery: string): string {
  let base = ENV.CLIENT_URL || 'http://localhost:3000';
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  base = base.replace(/\/$/, '');
  const cleanPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `${base}${cleanPath}`;
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
      return res.redirect(getClientCallbackUrl(`/auth/callback?error=${encodeURIComponent(String(error_description || error))}`));
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(getClientCallbackUrl('/auth/callback?error=NO_CODE_PROVIDED'));
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

      // Passo C: Localiza ou cadastra o usuário no MongoDB Atlas
      const computedRole = resolveRoleFromDiscord(discordRoles);
      let user = await UserModel.findOne({ discord_id: discordId });

      if (!user) {
        // Primeiro acesso: cadastra com a role mapeada dos cargos do Discord
        user = await UserModel.create({
          discord_id: discordId,
          name: name,
          username: discordUser.username,
          nickname: nickname,
          email: discordUser.email,
          avatar: avatarUrl,
          discord_roles: discordRoles,
          role: computedRole
        });
        console.log(`[+] Novo operador cadastrado no MongoDB Atlas: @${user.username} [${user.role}] (ID: ${user.discord_id})`);
      } else {
        // Atualiza avatar, nome, cargos e sincroniza role do Discord
        let nextRole = user.role;
        if (computedRole === 'ADMIN' || computedRole === 'GM') {
          nextRole = computedRole;
        } else if (user.role !== 'PENDING_GM') {
          nextRole = computedRole;
        }

        user = await UserModel.findByIdAndUpdate(
          user._id,
          {
            name: name,
            username: discordUser.username,
            nickname: nickname,
            avatar: avatarUrl,
            discord_roles: discordRoles,
            role: nextRole
          },
          { returnDocument: 'after' }
        );
        console.log(`[+] Operador sincronizado no MongoDB Atlas: @${user?.username} [${user?.role}]`);
      }

      // Passo D: Gera o JWT de sessão da aplicação
      const token = createToken(user!);

      // Define cookie seguro (suporta cross-domain se frontend estiver na Vercel e backend na VPS)
      const isCrossDomain = ENV.NODE_ENV === 'production' && !ENV.CLIENT_URL.includes('localhost');
      res.cookie('omninet_token', token, {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: isCrossDomain ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      // Redireciona para o frontend com o token
      return res.redirect(getClientCallbackUrl(`/auth/callback?token=${token}`));
    } catch (err: any) {
      console.error('[!] Falha na troca de credenciais do Discord:', err.response?.data || err.message);
      return res.redirect(getClientCallbackUrl('/auth/callback?error=AUTH_EXCHANGE_FAILED'));
    }
  },

  // 3. Retorna os dados do usuário autenticado atual
  async getMe(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const pilots = await PilotModel.find({ user_id: req.user._id }).sort({ is_active: -1, updatedAt: -1 });
    const activePilot = pilots.find((p) => p.is_active) || pilots[0] || null;

    return res.json({
      user: req.user,
      pilots,
      pilot: activePilot
    });
  },

  // 4. Encerra a sessão
  logout(req: Request, res: Response) {
    res.clearCookie('omninet_token');
    return res.json({ message: '[+] Sessão de terminal encerrada.' });
  },

  // 5. Autenticação simulada para desenvolvimento e testes
  async devLogin(req: Request, res: Response) {
    if (process.env.DISABLE_DEV_LOGIN === 'true') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Dev login desabilitado pelo administrador.' });
    }

    const { role = 'PILOT', username } = req.body || {};
    const validRoles: UserRole[] = ['PILOT', 'GM', 'ADMIN'];
    const chosenRole: UserRole = validRoles.includes(role) ? role : 'PILOT';
    const chosenUsername = username || `operador_${chosenRole.toLowerCase()}`;
    const discordId = `dev_${chosenRole.toLowerCase()}_${Date.now().toString().slice(-4)}`;

    let user = await UserModel.findOne({ username: chosenUsername });
    if (!user) {
      user = await UserModel.create({
        discord_id: discordId,
        username: chosenUsername,
        name: `Operador [${chosenRole}]`,
        role: chosenRole,
        avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
        discord_roles: []
      });
      console.log(`[+] Usuário Dev criado: @${user.username} [${user.role}]`);
    } else if (user.role !== chosenRole) {
      user.role = chosenRole;
      await user.save();
    }

    const token = createToken(user);

    const isCrossDomain = ENV.NODE_ENV === 'production' && !ENV.CLIENT_URL.includes('localhost');
    res.cookie('omninet_token', token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: isCrossDomain ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      message: `[+] Autenticado via Terminal Dev como @${user.username} [${user.role}].`,
      token,
      user
    });
  }
};
