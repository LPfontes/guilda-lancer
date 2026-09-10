import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';

export const adminRoutes = Router();

// Todas as rotas de administração exigem autenticação e a role ADMIN
adminRoutes.use(authenticateJWT, requireRole(['ADMIN']));

// 1. Listagem geral de usuários com filtros e estatísticas
adminRoutes.get('/users', AdminController.listUsers);

// 2. Atualização dos cargos do usuário (multi-roles)
adminRoutes.patch('/users/:id/roles', AdminController.updateUserRoles);

// 3. Atualização do perfil do usuário (nome, apelido)
adminRoutes.patch('/users/:id/profile', AdminController.updateUserProfile);

// 4. Exclusão permanente de usuário e pilotos associados
adminRoutes.delete('/users/:id', AdminController.deleteUser);
