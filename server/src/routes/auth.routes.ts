import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { optionalAuthenticateJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Iniciar login do Discord (Gera a URL de autorização)
router.get('/discord/login', AuthController.getDiscordAuthUrl);

// Rota de retorno (Callback do Discord OAuth2)
router.get('/discord/callback', AuthController.handleDiscordCallback);

// Consultar operador autenticado atual (suporta sessão ativa ou anônima com 200 OK)
router.get('/me', optionalAuthenticateJWT, AuthController.getMe);

// Encerrar sessão
router.post('/logout', AuthController.logout);

// Autenticação mock para desenvolvimento local
router.post('/dev-login', AuthController.devLogin);

export const authRoutes = router;
