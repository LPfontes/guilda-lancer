import { Router } from 'express';
import { MissionController } from '../controllers/mission.controller.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';

export const missionRoutes = Router();

// ==========================================
// 1. CONSULTAS PÚBLICAS E DETALHES (READ)
// ==========================================
// Listagem de missões com filtros (status, LL, busca, mestre, paginação)
missionRoutes.get('/', authenticateJWT, MissionController.listMissions);

// Detalhes completos de uma missão por ID (briefing, regras, esquadrão)
missionRoutes.get('/:id', authenticateJWT, MissionController.getMissionById);

// ==========================================
// 2. CANDIDATURA DE PILOTOS (MATCHMAKING)
// ==========================================
// Piloto se candidata à missão aberta
missionRoutes.post('/:id/apply', authenticateJWT, MissionController.applyToMission);

// Piloto cancela sua candidatura
missionRoutes.delete('/:id/apply', authenticateJWT, MissionController.cancelApplication);

// ==========================================
// 3. GERENCIAMENTO DE MISSÕES (GMs & ADMINs)
// ==========================================
// Criar nova missão
missionRoutes.post(
  '/',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  MissionController.createMission
);

// Atualizar dados da missão
missionRoutes.put(
  '/:id',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  MissionController.updateMission
);
missionRoutes.patch(
  '/:id',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  MissionController.updateMission
);

// Excluir ou cancelar missão
missionRoutes.delete(
  '/:id',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  MissionController.deleteMission
);

// Escalar esquadrão (Selecionar pilotos, lista de espera, rejeitados)
missionRoutes.post(
  '/:id/select-pilots',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  MissionController.selectPilots
);

// Iniciar a missão (Muda status para IN_PROGRESS e mobiliza pilotos)
missionRoutes.post(
  '/:id/start',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  MissionController.startMission
);

// Concluir a missão (Muda status para COMPLETED, arquiva AAR e libera pilotos)
missionRoutes.post(
  '/:id/complete',
  authenticateJWT,
  requireRole(['ADMIN', 'GM']),
  MissionController.completeMission
);
