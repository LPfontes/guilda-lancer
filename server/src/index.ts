import { app } from './app.js';
import { ENV, validateEnv } from './config/env.js';
import { connectMongoDB } from './database/db.js';

// Validate environment configuration
validateEnv();

async function bootstrap() {
  try {
    // 1. Connect to MongoDB Atlas
    await connectMongoDB();

    // 2. Start Express HTTP Server
    app.listen(ENV.PORT, () => {
      console.log(`
  =============================================================
  ⬣  OMNINET MISSION HUB // BACKEND ONLINE
  =============================================================
  [+] Server Port       : http://localhost:${ENV.PORT}
  [+] Frontend URL      : ${ENV.CLIENT_URL}
  [+] MongoDB Atlas     : CONECTADO (DB: guilda_lancer)
  [+] Discord OAuth2    : ${ENV.DISCORD_CLIENT_ID ? 'ONLINE' : 'NOT CONFIGURED'}
  [+] Guild ID          : ${ENV.DISCORD_GUILD_ID}
  [+] Callback Endpoint : ${ENV.DISCORD_REDIRECT_URI}
  =============================================================
      `);
    });
  } catch (err: any) {
    console.error('[!] Erro fatal na inicialização do servidor:', err.message);
    process.exit(1);
  }
}

bootstrap();
