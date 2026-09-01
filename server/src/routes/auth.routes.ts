import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Iniciar login do Discord (Gera a URL de autorização)
router.get('/discord/login', AuthController.getDiscordAuthUrl);

// Rota de retorno (Callback do Discord OAuth2)
router.get('/discord/callback', AuthController.handleDiscordCallback);

// Consultar operador autenticado atual
router.get('/me', authenticateJWT, AuthController.getMe);

// Encerrar sessão
router.post('/logout', AuthController.logout);

export const authRoutes = router;
