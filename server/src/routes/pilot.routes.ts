import { Router } from 'express';
import { PilotController } from '../controllers/pilot.controller.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';

export const pilotRoutes = Router();

// 1. Preview da ficha (não requer gravação)
pilotRoutes.post('/preview', PilotController.previewPilot);

// 2. Fichas do próprio operador autenticado (Hangar)
pilotRoutes.get('/me', authenticateJWT, PilotController.getMyPilot);
pilotRoutes.post('/submit', authenticateJWT, PilotController.submitPilot);
pilotRoutes.delete('/me', authenticateJWT, PilotController.deleteMyPilot);
pilotRoutes.delete('/:id', authenticateJWT, PilotController.deleteMyPilot);
pilotRoutes.post('/:id/activate', authenticateJWT, PilotController.setActivePilot);

// 3. Listagem geral de pilotos (com filtros)
pilotRoutes.get('/', authenticateJWT, PilotController.listPilots);

// 4. Detalhes de um piloto específico
pilotRoutes.get('/:id', authenticateJWT, PilotController.getPilotById);

// 5. Avaliação da ficha (Avaliadores / Admins e GMs)
pilotRoutes.post(
  '/:id/review',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  PilotController.reviewPilot
);
