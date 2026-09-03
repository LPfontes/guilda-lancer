import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';

/**
 * Visualização da Tela de Autenticação / Boas-vindas (Hero).
 * Oferece acesso oficial via Discord OAuth2 e painel de desenvolvedor local.
 */
export class AuthHeroView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render() {
    this.container.innerHTML = `
      <section class="auth-hero-section">
        <div class="auth-hero-glow" aria-hidden="true"></div>

        <div class="auth-hero-container">
          <div class="auth-radar-badge">
            <span class="radar-dot"></span>
            <span class="radar-text">// OMNINET GATEWAY v3.4 // ACESSO RESTRITO //</span>
          </div>

          <h1 class="auth-hero-title">
            TERMINAL TÁTICO
            <span class="auth-hero-title-highlight">GUILDA LANCER</span>
          </h1>

          <p class="auth-hero-description">
            Autentique sua credencial militar para acessar o hangar de chassis, importar fichas do 
            e mobilizar seu esquadrão em contratos da Guilda.
          </p>

          <!-- Botão Principal de Login Discord -->
          <div class="auth-primary-action">
            <button id="btn-discord-login" class="btn btn-discord-cta" type="button">
              <svg class="discord-cta-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>CONECTAR VIA DISCORD OAUTH2</span>
            </button>
          </div>

          <!-- Painel de Acesso Dev / Simulação Local -->
          <div class="auth-dev-panel">
            <div class="dev-panel-header">
              <span class="dev-panel-icon">⚙</span>
              <span class="dev-panel-title">MODO DE DESENVOLVIMENTO // ACESSO RÁPIDO LOCAL</span>
              <span class="dev-panel-tag">DEV MOCK</span>
            </div>
            <p class="dev-panel-text">
              Para testar funcionalidades sem necessidade de autorização externa do Discord, inicie uma sessão simulada:
            </p>
            <div class="dev-panel-actions">
              <button id="btn-dev-pilot" class="btn btn-secondary dev-btn" type="button">
                <span class="dev-btn-role">PILOTO</span>
                <span class="dev-btn-label">@operador_piloto</span>
              </button>
              <button id="btn-dev-gm" class="btn btn-secondary dev-btn dev-btn-gm" type="button">
                <span class="dev-btn-role">MESTRE (GM)</span>
                <span class="dev-btn-label">@mestre_operacoes</span>
              </button>
              <button id="btn-dev-admin" class="btn btn-secondary dev-btn dev-btn-admin" type="button">
                <span class="dev-btn-role">ADMIN</span>
                <span class="dev-btn-label">@admin_omninet</span>
              </button>
            </div>
          </div>

          <!-- Telemetria do Terminal -->
          <div class="auth-terminal-telemetry">
            <div class="telemetry-item">
              <span class="telemetry-label">REDE:</span>
              <span class="telemetry-val text-mint">OMNINET CONECTADA</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">GATEWAY:</span>
              <span class="telemetry-val">US-EAST // CLUSTER-0</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">PROTOCOLO:</span>
              <span class="telemetry-val">PARACAUSAL v3.4</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">CRIPTOGRAFIA:</span>
              <span class="telemetry-val">AES-256-GCM</span>
            </div>
          </div>
        </div>
      </section>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    // 1. Botão Discord OAuth2
    const discordBtn = this.container.querySelector('#btn-discord-login');
    discordBtn?.addEventListener('click', async () => {
      ToastService.info('Contatando gateway de autenticação do Discord...');
      await authService.initiateDiscordLogin();
    });

    // 2. Dev login como PILOT
    const devPilotBtn = this.container.querySelector('#btn-dev-pilot');
    devPilotBtn?.addEventListener('click', async () => {
      const ok = await authService.devLogin('PILOT', 'piloto_teste');
      if (ok) window.location.hash = '#/hangar';
    });

    // 3. Dev login como GM
    const devGmBtn = this.container.querySelector('#btn-dev-gm');
    devGmBtn?.addEventListener('click', async () => {
      const ok = await authService.devLogin('GM', 'mestre_vanguard');
      if (ok) window.location.hash = '#/missions';
    });

    // 4. Dev login como ADMIN
    const devAdminBtn = this.container.querySelector('#btn-dev-admin');
    devAdminBtn?.addEventListener('click', async () => {
      const ok = await authService.devLogin('ADMIN', 'comandante_admin');
      if (ok) window.location.hash = '#/hangar';
    });
  }
}
