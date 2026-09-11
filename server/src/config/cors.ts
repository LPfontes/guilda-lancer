import { ENV } from './env.js';

/**
 * Validador de origens permitidas via CORS e WebSockets.
 * Utiliza exclusivamente as variáveis de ambiente (ENV.ALLOWED_ORIGINS / ENV.CLIENT_URL)
 * e autoriza o ambiente local apenas durante o desenvolvimento.
 */
export const isOriginAllowed = (origin?: string): boolean => {
  // Requisições sem origem (same-origin, ferramentas CLI, server-to-server)
  if (!origin) return true;

  const cleanOrigin = origin.trim().replace(/\/$/, '');

  // 1. Origens explicitamente permitidas definidas nas variáveis de ambiente (.env)
  if (ENV.ALLOWED_ORIGINS && ENV.ALLOWED_ORIGINS.length > 0) {
    if (ENV.ALLOWED_ORIGINS.includes(cleanOrigin)) return true;
  }

  // 2. Fallback direto para ENV.CLIENT_URL
  if (ENV.CLIENT_URL && cleanOrigin === ENV.CLIENT_URL) {
    return true;
  }

  // 3. Ambiente de Desenvolvimento local (apenas quando não em produção)
  if (ENV.NODE_ENV !== 'production') {
    const isSafeLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
    if (isSafeLocalhost) return true;
  }

  return false;
};


