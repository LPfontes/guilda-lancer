import { authService } from './services/auth.service.js';
import { HeaderComponent } from './components/header.js';
import { AuthHeroView } from './views/auth-hero.view.js';
import { TerminalBackground } from './components/terminal-background.js';

class OmninetApp {
  private contentEl: HTMLElement | null = null;
  private headerComponent: HeaderComponent | null = null;
  private terminalBg: TerminalBackground | null = null;

  constructor() {
    this.contentEl = document.getElementById('main-content');
  }

  async init() {
    console.log('[+] Inicializando Terminal Omninet...');

    // 1. Inicia o canvas de telemetria no fundo
    this.terminalBg = new TerminalBackground('terminal-stream-bg');
    this.terminalBg.start();

    // 2. Monta o cabeçalho tático reativo
    this.headerComponent = new HeaderComponent('main-header');
    this.headerComponent.mount();

    // 3. Processa retorno de autenticação OAuth se houver
    await authService.processAuthCallback();

    // 4. Verifica a sessão existente
    await authService.checkAuth();

    // 5. Escuta mudanças na autenticação e na rota (hash)
    authService.subscribe(() => {
      this.route();
    });

    window.addEventListener('hashchange', () => {
      this.route();
    });

    // 6. Renderiza a visualização inicial
    this.route();
  }

  private route() {
    if (!this.contentEl) return;

    const hash = window.location.hash || '#/';
    const isAuthenticated = authService.isAuthenticated;

    // Se não estiver autenticado, exibe a tela de login / hero
    if (!isAuthenticated) {
      const authHero = new AuthHeroView(this.contentEl);
      authHero.render();
      return;
    }

    // Se estiver autenticado e na rota raiz (#/), exibe o Dashboard Tático Hub
    if (hash === '#/' || hash === '' || hash === '#/dashboard') {
      this.renderDashboard();
      return;
    }

    // Rota transitória do Hangar
    if (hash.startsWith('#/hangar')) {
      this.renderHangarPlaceholder();
      return;
    }

    // Rota transitória de Missões
    if (hash.startsWith('#/missions')) {
      this.renderMissionsPlaceholder();
      return;
    }

    // Rota transitória de Avaliações
    if (hash.startsWith('#/review')) {
      this.renderReviewPlaceholder();
      return;
    }

    // Fallback padrão
    this.renderDashboard();
  }

  private renderDashboard() {
    if (!this.contentEl) return;

    const user = authService.currentUser;
    const pilot = authService.activePilot;
    const pilots = authService.pilots;

    this.contentEl.innerHTML = `
      <div class="dashboard-container">
        <div class="auth-radar-badge">
          <span class="radar-dot"></span>
          <span>ESTAÇÃO OPERACIONAL ATIVA // GUILDA LANCER</span>
        </div>

        <h1 class="dashboard-title">
          BEM-VINDO AO TERMINAL, ${user ? user.username.toUpperCase() : 'OPERADOR'}
        </h1>
        <p class="dashboard-subtitle">
          Canal de dados seguro estabelecido. Gerencie seus mechas no hangar ou candidate-se aos contratos disponíveis.
        </p>

        <!-- Resumo do Chassi Ativo se existir -->
        ${
          pilot
            ? `
          <div class="card" style="margin-bottom: 2rem; border-color: var(--border-active); text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-mint); margin-bottom: 4px;">
                  // CHASSI ATIVO MOBILIZADO
                </div>
                <h2 style="font-size: 1.4rem; color: #fff; margin-bottom: 4px;">
                  ${pilot.callsign} <span style="font-size: 0.9rem; color: var(--text-muted);">[LL ${pilot.license_level}]</span>
                </h2>
                <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-dim);">
                  ${pilot.active_mech_frame || 'Everest Padrão'} — ${pilot.active_mech_name || 'Mech Primário'}
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span class="role-badge role-pilot" style="font-size: 0.8rem; padding: 4px 8px;">STATUS: ${pilot.status}</span>
                <a href="#/hangar" class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.5rem 1rem;">
                  VER FICHA COMPLETA
                </a>
              </div>
            </div>
          </div>
        `
            : `
          <div class="card" style="margin-bottom: 2rem; border-color: rgba(245, 158, 11, 0.4); text-align: left; background: rgba(24, 20, 10, 0.6);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #f59e0b; margin-bottom: 4px;">
                  ▲ NENHUM CHASSI VINCULADO
                </div>
                <div style="font-size: 1rem; color: var(--text-main);">
                  Seu operador ainda não possui uma ficha de piloto do COMP/CON sincronizada.
                </div>
              </div>
              <a href="#/hangar" class="btn btn-primary" style="font-size: 0.75rem; padding: 0.5rem 1rem;">
                IMPORTAR FICHA NO HANGAR
              </a>
            </div>
          </div>
        `
        }
      </div>
    `;
  }

  private renderHangarPlaceholder() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div style="padding: 2rem 0; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <a href="#/" style="color: var(--text-dim); text-decoration: none; font-size: 0.8rem; font-family: var(--font-mono);">
              ← RETORNAR AO HUB
            </a>
            <h1 style="font-size: 2rem; color: var(--text-main); margin-top: 0.5rem;">
              HANGAR DE CHASSIS
            </h1>
          </div>
        </div>
        <div class="card" style="padding: 3rem 2rem; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">⚙</div>
          <h2 style="font-size: 1.25rem; color: var(--accent-mint); margin-bottom: 0.5rem;">
            SEÇÃO DO HANGAR (PRÓXIMA PARTE DO PLANO)
          </h2>
          <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto 1.5rem;">
            O fluxo de autenticação e sessão está ativo com sucesso! O hangar com suporte completo a importação COMP/CON v3 será construído na etapa 2.
          </p>
          <a href="#/" class="btn btn-secondary">VOLTAR AO INÍCIO</a>
        </div>
      </div>
    `;
  }

  private renderMissionsPlaceholder() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div style="padding: 2rem 0; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <a href="#/" style="color: var(--text-dim); text-decoration: none; font-size: 0.8rem; font-family: var(--font-mono);">
              ← RETORNAR AO HUB
            </a>
            <h1 style="font-size: 2rem; color: var(--text-main); margin-top: 0.5rem;">
              MURAL DE OPERAÇÕES WEST MARCHES
            </h1>
          </div>
        </div>
        <div class="card" style="padding: 3rem 2rem; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">◈</div>
          <h2 style="font-size: 1.25rem; color: var(--accent-mint); margin-bottom: 0.5rem;">
            SEÇÃO DE MISSÕES (ETAPA 3 DO PLANO)
          </h2>
          <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto 1.5rem;">
            O quadro de operações e matchmaking com pontuação de prioridade será implementado após o Hangar.
          </p>
          <a href="#/" class="btn btn-secondary">VOLTAR AO INÍCIO</a>
        </div>
      </div>
    `;
  }

  private renderReviewPlaceholder() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div style="padding: 2rem 0; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <a href="#/" style="color: var(--text-dim); text-decoration: none; font-size: 0.8rem; font-family: var(--font-mono);">
              ← RETORNAR AO HUB
            </a>
            <h1 style="font-size: 2rem; color: var(--text-main); margin-top: 0.5rem;">
              COMITÊ DE AVALIAÇÃO (MESTRES / ADMIN)
            </h1>
          </div>
        </div>
        <div class="card" style="padding: 3rem 2rem; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">▲</div>
          <h2 style="font-size: 1.25rem; color: #fbbf24; margin-bottom: 0.5rem;">
            PAINEL DE AVALIAÇÃO DE FICHAS (ETAPA 4 DO PLANO)
          </h2>
          <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto 1.5rem;">
            Aprovação e rejeição com justificativas para submissões de pilotos.
          </p>
          <a href="#/" class="btn btn-secondary">VOLTAR AO INÍCIO</a>
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
