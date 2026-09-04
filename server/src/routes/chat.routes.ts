import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';

export const chatRoutes = Router();

// ==========================================
// 1. CANAL PRÉ-MISSÃO (MESSAGES)
// ==========================================
// Histórico de mensagens da missão
chatRoutes.get('/missions/:missionId/messages', authenticateJWT, ChatController.getMissionMessages);

// Enviar mensagem no canal da missão
chatRoutes.post('/missions/:missionId/messages', authenticateJWT, ChatController.sendMissionMessage);

// ==========================================
// 2. CANAL & FEED DE RELATÓRIOS (REPORTS)
// ==========================================
// Listar relatórios públicos
chatRoutes.get('/reports', authenticateJWT, ChatController.getReports);

// Submeter novo relatório de missão
chatRoutes.post('/reports', authenticateJWT, ChatController.submitReport);

// Homologar relatório (Mestre / Admin)
chatRoutes.patch(
  '/reports/:messageId/validate',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  ChatController.validateReport
);

// Comentários do relatório
chatRoutes.get('/reports/:reportId/comments', authenticateJWT, ChatController.getReportComments);
chatRoutes.post('/reports/:reportId/comments', authenticateJWT, ChatController.addReportComment);
