import { ApiClient } from './services/api.js';
import { IAuthSession } from './types/user.types.js';
import { TerminalBackground } from './components/terminal-background.js';

class OmninetApp {
  private headerEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private session: IAuthSession = { user: null, pilot: null, pilots: [] };
  private terminalBg: TerminalBackground | null = null;

  constructor() {
    this.headerEl = document.getElementById('main-header');
    this.contentEl = document.getElementById('main-content');
  }

  async init() {
    console.log('[+] Inicializando Terminal Omninet...');
    // Inicia o fluxo de telemetria e código em cascata no fundo
    this.terminalBg = new TerminalBackground('terminal-stream-bg');
    this.terminalBg.start();

    await this.checkAuth();
    this.renderHeader();
    this.renderHome();
  }

  private async checkAuth() {
    try {
      const data = await ApiClient.get<IAuthSession>('/auth/me');
      this.session = data;
    } catch {
      this.session = { user: null, pilot: null, pilots: [] };
    }
  }

  private renderHeader() {
    if (!this.headerEl) return;

    const user = this.session.user;
    const activePilot = this.session.pilot;

    this.headerEl.innerHTML = `
        ${
          user
            ? `
          <nav class="header-nav">
            <button id="nav-hangar" class="btn btn-secondary header-nav-btn">
              HANGAR (${this.session.pilots.length})
            </button>
            <button id="nav-missions" class="btn btn-secondary header-nav-btn">
              MISSÕES
            </button>
          </nav>
        `
            : ''
        }
      </div>

      <div class="header-user-area">
        ${
          user
            ? `
          <div class="header-user-info">
            <div class="header-callsign">
              ${activePilot ? `[${activePilot.callsign}]` : `@${user.username}`}
            </div>
            <div class="header-user-level">
              NÍVEL: ${user.role}
            </div>
          </div>
          <button id="btn-logout" class="btn btn-secondary header-nav-btn">
            SAIR
          </button>
        `
            : `
          <div class="header-locked-badge">
            [STATUS: TERMINAL BLOQUEADO]
          </div>
        `
        }
      </div>
    `;

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      await ApiClient.post('/auth/logout');
      window.location.reload();
    });
  }

  private renderHome() {
    if (!this.contentEl) return;

    const user = this.session.user;

    // Tela Inicial para usuário DESLOGADO: apenas título e botão de entrar via Discord
    if (!user) {
      this.contentEl.innerHTML = `
        <div class="auth-hero-container">
          <div class="auth-badge">
            // ACESSO RESTRITO AO PESSOAL DA GUILDA
          </div>
          
          <h1 class="auth-title">
            TERMINAL TÁTICO
          </h1>
          
          <p class="auth-subtitle">
            Autentique sua credencial de operador para acessar o hangar de mechas, importar fichas do COMP/CON e visualizar missões.
          </p>

          <div class="auth-btn-wrapper">
            <a
              id="btn-login-discord"
              href="/api/auth/discord"
              class="btn btn-primary auth-discord-btn"
            >
              <svg class="discord-icon" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              ENTRAR VIA DISCORD
            </a>
          </div>
        </div>
      `;
      return;
    }

    // Tela para usuário LOGADO: dashboard operacional com Hangar e Missões
    this.contentEl.innerHTML = `
      <div class="dashboard-container">
        <h1 class="dashboard-title">
          TERMINAL TÁTICO
        </h1>
        <p class="dashboard-subtitle">
          Gerenciamento operacional da guilda: importe fichas do COMP/CON v3, selecione seu mech ativo e candidate-se a missões.
        </p>

        <div class="dashboard-grid">
          <div class="card">
            <h3 class="card-title-crimson">Hangar de Pilotos</h3>
            <p class="card-text">
              Sincronize seu piloto via Share Code de 12 dígitos ou JSON oficial do COMP/CON.
            </p>
            <button class="btn btn-primary card-action-btn">
              ACESSAR HANGAR
            </button>
          </div>

          <div class="card">
            <h3 class="card-title-mint">Mural de Missões</h3>
            <p class="card-text">
              Consulte contratos abertos por GMs da União e candidate seu esquadrão.
            </p>
            <button class="btn btn-secondary card-action-btn">
              VER OPERAÇÕES
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  const app = new OmninetApp();
  app.init();
});
