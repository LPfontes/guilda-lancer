import { ENV } from './env.js';

/**
 * Validador dinâmico de origens permitidas via CORS e WebSockets.
 * Suporta explicitamente o domínio configurado em ENV.CLIENT_URL,
 * qualquer deploy/preview da Vercel (*.vercel.app) e desenvolvimento local.
 */
export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  if (origin === ENV.CLIENT_URL) return true;
  if (origin.endsWith('.vercel.app')) return true;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  if (ENV.CLIENT_URL && ENV.CLIENT_URL.includes(',')) {
    const urls = ENV.CLIENT_URL.split(',').map((u) => u.trim());
    if (urls.includes(origin)) return true;
  }
  return false;
};
