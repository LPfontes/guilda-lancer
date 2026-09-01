import { app } from './app.js';
import { ENV, validateEnv } from './config/env.js';

// Validate Discord OAuth2 configuration
validateEnv();

app.listen(ENV.PORT, () => {
  console.log(`
  =============================================================
  ⬣  OMNINET MISSION HUB // BACKEND AUTH GATEWAY INITIALIZED
  =============================================================
  [+] Server Port       : http://localhost:${ENV.PORT}
  [+] Frontend URL      : ${ENV.CLIENT_URL}
  [+] Discord OAuth2    : ${ENV.DISCORD_CLIENT_ID ? 'ONLINE' : 'NOT CONFIGURED'}
  [+] Callback Endpoint : ${ENV.DISCORD_REDIRECT_URI}
  =============================================================
  `);
});
