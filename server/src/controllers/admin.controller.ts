import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserModel, PilotModel, UserRole, getHighestRole } from '../database/db.js';

export const AdminController = {
  /**
   * 1. Listagem geral de operadores para a administração.
   * Suporta filtros por role, busca por texto, paginação e estatísticas globais de cargos.
   */
  async listUsers(req: Request, res: Response) {
    try {
      const { search, role, page = '1', limit = '20' } = req.query;

      const filter: Record<string, any> = {};

      if (role && role !== 'ALL') {
        // Busca operadores que contenham a role no array ou no campo primário
        filter.$or = [
          { roles: role },
          { role: role }
        ];
      }

      if (search && typeof search === 'string' && search.trim()) {
        const regex = { $regex: search.trim(), $options: 'i' };
        const searchOr = [
          { username: regex },
          { name: regex },
          { nickname: regex },
          { discord_id: regex }
        ];

        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
          delete filter.$or;
        } else {
          filter.$or = searchOr;
        }
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [users, total, allUsersForStats] = await Promise.all([
        UserModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        UserModel.countDocuments(filter),
        UserModel.find({}, { roles: 1, role: 1 }).lean()
      ]);

      // Estatísticas globais do painel
      const stats = {
        total: allUsersForStats.length,
        admins: allUsersForStats.filter((u: any) => (u.roles || [u.role]).includes('ADMIN')).length,
        gms: allUsersForStats.filter((u: any) => (u.roles || [u.role]).includes('GM')).length,
        avaliadores: allUsersForStats.filter((u: any) => (u.roles || [u.role]).includes('AVALIADOR')).length,
        pilots: allUsersForStats.filter((u: any) => (u.roles || [u.role]).includes('PILOT')).length
      };

      // Mapeia pilotos associados a cada usuário
      const userIds = users.map((u: any) => u._id);
      const pilots = await PilotModel.find(
        { user_id: { $in: userIds } },
        { user_id: 1, callsign: 1, license_level: 1, is_active: 1, active_mech_name: 1, status: 1 }
      ).lean();

      const pilotsByUser: Record<string, any[]> = {};
      for (const p of pilots) {
        const uid = p.user_id.toString();
        if (!pilotsByUser[uid]) pilotsByUser[uid] = [];
        pilotsByUser[uid].push(p);
      }

      const usersWithPilots = users.map((u: any) => {
        const uRoles: UserRole[] = u.roles && u.roles.length > 0 ? u.roles : [u.role || 'PILOT'];
        return {
          ...u,
          roles: uRoles,
          role: u.role || getHighestRole(uRoles),
          pilots: pilotsByUser[u._id.toString()] || []
        };
      });

      return res.json({
        users: usersWithPilots,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          total_pages: Math.ceil(total / limitNum)
        },
        stats
      });
    } catch (err: any) {
      console.error('[!] Erro ao listar usuários para administração:', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  },

  /**
   * 2. Atualização dos cargos (roles) de um operador.
   */
  async updateUserRoles(req: Request, res: Response) {
    const { id } = req.params;
    const { roles } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: '[!] ID de operador inválido.' });
    }

    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        error: 'INVALID_ROLES',
        message: '[!] O operador deve possuir pelo menos um cargo válido.'
      });
    }

    const validRoles: UserRole[] = ['PILOT', 'GM', 'AVALIADOR', 'ADMIN'];
    const filteredRoles = Array.from(new Set(roles)).filter((r): r is UserRole => validRoles.includes(r as any));

    if (filteredRoles.length === 0) {
      return res.status(400).json({
        error: 'INVALID_ROLES',
        message: '[!] Nenhum cargo válido informado. Válidos: PILOT, GM, AVALIADOR, ADMIN.'
      });
    }

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Operador não localizado.' });
    }

    // Proteção: não permitir que o último ADMIN remova seu próprio cargo de ADMIN
    if (req.user && req.user._id.toString() === user._id.toString() && !filteredRoles.includes('ADMIN')) {
      const otherAdmins = await UserModel.countDocuments({
        _id: { $ne: user._id },
        $or: [{ roles: 'ADMIN' }, { role: 'ADMIN' }]
      });
      if (otherAdmins === 0) {
        return res.status(400).json({
          error: 'CANNOT_DEMOTE_LAST_ADMIN',
          message: '[!] Não é permitido remover o único Administrador ativo do sistema.'
        });
      }
    }

    user.roles = filteredRoles;
    user.role = getHighestRole(filteredRoles);
    await user.save();

    console.log(`[+] Cargos do operador @${user.username} atualizados por @${req.user?.username}: [${user.roles.join(', ')}]`);

    return res.json({
      message: `[+] Cargos de @${user.username} atualizados com sucesso.`,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        roles: user.roles,
        role: user.role
      }
    });
  },

  /**
   * 3. Atualização de dados de perfil (Nome de exibição e apelido).
   */
  async updateUserProfile(req: Request, res: Response) {
    const { id } = req.params;
    const { name, nickname } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: '[!] ID de operador inválido.' });
    }

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Operador não localizado.' });
    }

    if (typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }
    if (nickname !== undefined) {
      user.nickname = typeof nickname === 'string' ? nickname.trim() : undefined;
    }

    await user.save();

    console.log(`[+] Perfil de @${user.username} atualizado por @${req.user?.username}.`);

    return res.json({
      message: `[+] Perfil do operador @${user.username} atualizado com sucesso.`,
      user
    });
  },

  /**
   * 4. Exclusão permanente de um operador do sistema.
   * Remove em cascata seus pilotos do hangar.
   */
  async deleteUser(req: Request, res: Response) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: '[!] ID de operador inválido.' });
    }

    // Não permitir excluir a si mesmo
    if (req.user && req.user._id.toString() === id) {
      return res.status(400).json({
        error: 'CANNOT_DELETE_SELF',
        message: '[!] Você não pode excluir a sua própria conta de administrador ativa.'
      });
    }

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Operador não localizado.' });
    }

    // Não permitir excluir se for o único ADMIN
    const isUserAdmin = (user.roles || [user.role]).includes('ADMIN');
    if (isUserAdmin) {
      const otherAdmins = await UserModel.countDocuments({
        _id: { $ne: user._id },
        $or: [{ roles: 'ADMIN' }, { role: 'ADMIN' }]
      });
      if (otherAdmins === 0) {
        return res.status(400).json({
          error: 'CANNOT_DELETE_LAST_ADMIN',
          message: '[!] Não é permitido excluir o único Administrador ativo do sistema.'
        });
      }
    }

    // Remove pilotos do hangar em cascata
    await PilotModel.deleteMany({ user_id: user._id });

    // Exclui o operador
    await UserModel.findByIdAndDelete(id);

    console.log(`[+] Operador @${user.username} excluído permanentemente por @${req.user?.username}.`);

    return res.json({
      message: `[+] Operador @${user.username} e seus pilotos associados foram removidos com sucesso.`
    });
  }
};
