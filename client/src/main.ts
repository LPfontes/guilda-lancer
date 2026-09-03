import { authService } from './services/auth.service.js';
import { HeaderComponent } from './components/header.js';
import { AuthHeroView } from './views/auth-hero.view.js';
import { TerminalBackground } from './components/terminal-background.js';
import { getCompconIcon } from './components/compcon-icons.js';

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

    this.contentEl.innerHTML = `
      <div class="dashboard-container">
        <div class="dashboard-status-tag">
          [ ESTAÇÃO OPERACIONAL ATIVA // GUILDA LANCER ]
        </div>

        <h1 class="dashboard-title">
          BEM-VINDO, ${user ? user.username.toUpperCase() : 'OPERADOR'}
        </h1>
        <p class="dashboard-subtitle">
          Canal seguro estabelecido. Acesse o hangar para configurar seus mechas ou consulte as missões ativas.
        </p>

        <!-- Resumo do Chassi Ativo se existir -->
        ${
          pilot
            ? `
          <div class="card pilot-hero-card">
            <div class="pilot-hero-content">
              <div>
                <div class="pilot-hero-tag">
                  // CHASSI ATIVO MOBILIZADO
                </div>
                <h2 class="pilot-hero-callsign">
                  ${pilot.callsign} <span class="pilot-hero-ll">[LL ${pilot.license_level}]</span>
                </h2>
                <div class="pilot-hero-frame">
                  ${pilot.active_mech_frame || 'Everest Padrão'} — ${pilot.active_mech_name || 'Mech Primário'}
                </div>
              </div>
              <div class="pilot-hero-actions">
                <span class="role-badge role-pilot pilot-hero-status">STATUS: ${pilot.status}</span>
                <a href="#/hangar" class="btn btn-secondary pilot-hero-btn">
                  VER FICHA COMPLETA
                </a>
              </div>
            </div>
          </div>
        `
            : `
          <div class="card no-pilot-card">
            <div class="no-pilot-content">
              <div>
                <div class="no-pilot-tag">
                  <i class="mdi mdi-alert-circle-outline"></i> NENHUM CHASSI VINCULADO
                </div>
                <div class="no-pilot-message">
                  Seu operador ainda não possui uma ficha de piloto do COMP/CON sincronizada.
                </div>
              </div>
              <a href="#/hangar" class="btn btn-primary no-pilot-btn">
                <i class="mdi mdi-download"></i>
                <span>IMPORTAR FICHA</span>
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
      <div class="placeholder-wrapper">
        <div class="placeholder-header">
          <div>
            <a href="#/" class="placeholder-back-link">
              <i class="mdi mdi-arrow-left"></i> RETORNAR AO HUB
            </a>
            <h1 class="placeholder-title">
              ${getCompconIcon('hangar', 'compcon-icon placeholder-title-icon')}
              <span>HANGAR DE CHASSIS</span>
            </h1>
          </div>
        </div>
        <div class="card placeholder-card">
          <div class="placeholder-icon-box">
            ${getCompconIcon('hangar', 'compcon-icon-lg')}
          </div>
          <h2 class="placeholder-subtitle">
            SEÇÃO DO HANGAR (ETAPA 2 DO PLANO)
          </h2>
          <p class="placeholder-text">
            O fluxo de autenticação e sessão está ativo com sucesso! O hangar com suporte completo a importação COMP/CON v3 será construído na etapa 2.
          </p>
          <a href="#/" class="btn btn-secondary">
            <i class="mdi mdi-arrow-left"></i> VOLTAR AO INÍCIO
          </a>
        </div>
      </div>
    `;
  }

  private renderMissionsPlaceholder() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="placeholder-wrapper">
        <div class="placeholder-header">
          <div>
            <a href="#/" class="placeholder-back-link placeholder-back-link-blue">
              <i class="mdi mdi-arrow-left"></i> RETORNAR AO HUB
            </a>
            <h1 class="placeholder-title">
              ${getCompconIcon('missions', 'compcon-icon placeholder-title-icon-blue')}
              <span>MURAL DE OPERAÇÕES</span>
            </h1>
          </div>
        </div>
        <div class="card placeholder-card">
          <div class="placeholder-icon-box placeholder-icon-box-blue">
            ${getCompconIcon('missions', 'compcon-icon-lg')}
          </div>
          <h2 class="placeholder-subtitle placeholder-subtitle-blue">
            SEÇÃO DE MISSÕES (ETAPA 3 DO PLANO)
          </h2>
          <p class="placeholder-text">
            O quadro de operações e matchmaking com pontuação de prioridade será implementado após o Hangar.
          </p>
          <a href="#/" class="btn btn-missions">
            <i class="mdi mdi-arrow-left"></i> VOLTAR AO INÍCIO
          </a>
        </div>
      </div>
    `;
  }

  private renderReviewPlaceholder() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="placeholder-wrapper">
        <div class="placeholder-header">
          <div>
            <a href="#/" class="placeholder-back-link">
              <i class="mdi mdi-arrow-left"></i> RETORNAR AO HUB
            </a>
            <h1 class="placeholder-title">
              ${getCompconIcon('review', 'compcon-icon placeholder-title-icon-gold')}
              <span>COMITÊ DE AVALIAÇÃO</span>
            </h1>
          </div>
        </div>
        <div class="card placeholder-card">
          <div class="placeholder-icon-box-gold">
            ${getCompconIcon('review', 'compcon-icon-lg')}
          </div>
          <h2 class="placeholder-subtitle-gold">
            PAINEL DE AVALIAÇÃO DE FICHAS (ETAPA 4 DO PLANO)
          </h2>
          <p class="placeholder-text">
            Aprovação e rejeição com justificativas para submissões de pilotos.
          </p>
          <a href="#/" class="btn btn-secondary">
            <i class="mdi mdi-arrow-left"></i> VOLTAR AO INÍCIO
          </a>
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
