import dotenv from 'dotenv';
import path from 'path';

// Load .env from root and current directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/api/auth/discord/callback',
  JWT_SECRET: process.env.JWT_SECRET || 'chave_secreta_super_segura_omninet',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validate critical Discord OAuth2 environment variables
export function validateEnv() {
  const missing: string[] = [];
  if (!ENV.DISCORD_CLIENT_ID) missing.push('DISCORD_CLIENT_ID');
  if (!ENV.DISCORD_CLIENT_SECRET) missing.push('DISCORD_CLIENT_SECRET');
  if (!ENV.DISCORD_REDIRECT_URI) missing.push('DISCORD_REDIRECT_URI');

  if (missing.length > 0) {
    console.warn(`[!] AVISO: As seguintes variáveis do Discord OAuth2 estão ausentes: ${missing.join(', ')}`);
  } else {
    console.log(`[+] Discord OAuth2 configurado com sucesso (Client ID: ${ENV.DISCORD_CLIENT_ID})`);
  }
}
