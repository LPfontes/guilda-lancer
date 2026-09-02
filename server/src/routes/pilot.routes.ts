import { Router } from 'express';
import { PilotController } from '../controllers/pilot.controller.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';

export const pilotRoutes = Router();

// ==========================================
// 1. UTILIDADES & PREVIEW (SEM PERSISTÊNCIA)
// ==========================================
pilotRoutes.post('/preview', PilotController.previewPilot);

// ==========================================
// 2. HANGAR DO OPERADOR AUTENTICADO
// ==========================================
pilotRoutes.get('/me', authenticateJWT, PilotController.getMyPilot);
pilotRoutes.delete('/me', authenticateJWT, PilotController.deleteMyPilot);

// ==========================================
// 3. CRUD RESTful COMPLETO DE PILOTOS
// ==========================================
// CREATE: Criação manual de piloto ou importação COMP/CON
pilotRoutes.post('/', authenticateJWT, PilotController.createPilot);
pilotRoutes.post('/submit', authenticateJWT, PilotController.submitPilot);
pilotRoutes.post('/import', authenticateJWT, PilotController.submitPilot);

// READ: Listagem geral com filtros (status, LL, busca, paginação)
pilotRoutes.get('/', authenticateJWT, PilotController.listPilots);

// READ: Detalhes completos de um piloto por ID
pilotRoutes.get('/:id', authenticateJWT, PilotController.getPilotById);

// UPDATE: Atualização completa (PUT) ou parcial (PATCH) dos dados do piloto
pilotRoutes.put('/:id', authenticateJWT, PilotController.updatePilot);
pilotRoutes.patch('/:id', authenticateJWT, PilotController.updatePilot);

// DELETE: Exclusão de um piloto por ID
pilotRoutes.delete('/:id', authenticateJWT, PilotController.deleteMyPilot);

// ==========================================
// 4. AÇÕES ESPECIAIS (ATIVAÇÃO & AVALIAÇÃO)
// ==========================================
// Ativar piloto no hangar do operador
pilotRoutes.post('/:id/activate', authenticateJWT, PilotController.setActivePilot);

// Avaliação da ficha por Avaliadores / Admins e GMs
pilotRoutes.post(
  '/:id/review',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  PilotController.reviewPilot
);
