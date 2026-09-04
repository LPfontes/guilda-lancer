import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { UserModel, IUser, UserRole } from '../database/db.js';

export interface AuthenticatedUserPayload {
  userId: string;
  discord_id: string;
  name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.omninet_token;
  const authHeader = req.headers.authorization;

  let token: string | undefined;

  // Prioriza o cookie seguro HttpOnly omninet_token, mantendo Authorization Bearer como fallback
  if (cookieToken) {
    token = cookieToken;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: '[!] Omninet Terminal: Token de autorização ausente ou expirado.'
    });
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthenticatedUserPayload;
    const user = await UserModel.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: '[!] Operador não localizado no registro da Omninet.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: '[!] Assinatura de credencial militar corrompida ou inválida.'
    });
  }
}

/**
 * Middleware opcional de autenticação: se o token existir e for válido, define req.user.
 * Se não houver token ou for inválido, prossegue com req.user = undefined sem disparar erro HTTP 401.
 */
export async function optionalAuthenticateJWT(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.omninet_token;
  const authHeader = req.headers.authorization;

  let token: string | undefined;

  if (cookieToken) {
    token = cookieToken;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthenticatedUserPayload;
    const user = await UserModel.findById(decoded.userId);
    req.user = user || undefined;
  } catch {
    req.user = undefined;
  }

  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '[!] Autenticação prévia obrigatória.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `[!] Acesso Negado: Seu nível operacional (${req.user.role}) não possui autorização requerida (${allowedRoles.join(', ')}).`
      });
    }

    next();
  };
}
