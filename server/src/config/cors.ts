import { ENV } from './env.js';

/**
 * Validador dinâmico de origens permitidas via CORS e WebSockets.
 * Suporta explicitamente o domínio configurado em ENV.CLIENT_URL,
 * qualquer deploy/preview da Vercel (*.vercel.app) e desenvolvimento local.
 */
export const isOriginAllowed = (origin?: string): boolean => {
  // Requisições sem origem (same-origin, ferramentas CLI, server-to-server)
  if (!origin) return true;

  // 1. Origem principal configurada no CLIENT_URL
  if (ENV.CLIENT_URL) {
    if (origin === ENV.CLIENT_URL) return true;
    if (ENV.CLIENT_URL.includes(',')) {
      const allowedList = ENV.CLIENT_URL.split(',').map((u) => u.trim());
      if (allowedList.includes(origin)) return true;
    }
  }

  // 2. Ambiente de Desenvolvimento: permite apenas localhost e 127.0.0.1 com portas numéricas
  if (ENV.NODE_ENV !== 'production') {
    const isSafeLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isSafeLocalhost) return true;
  }

  return false;
};
