import { authService } from './services/auth.service.js';
import { HeaderComponent } from './components/header.js';
import { AuthHeroView } from './views/auth-hero.view.js';
import { HangarView } from './views/hangar.view.js';
import { PilotSheetView } from './views/pilot-sheet.view.js';
import { MechSheetView } from './views/mech-sheet.view.js';
import { MissionsView } from './views/missions.view.js';
import { ReviewView } from './views/review.view.js';
import { TerminalBackground } from './components/terminal-background.js';
import { getCompconIcon } from './components/compcon-icons.js';

class OmninetApp {
  private contentEl: HTMLElement | null = null;
  private headerComponent: HeaderComponent | null = null;
  private terminalBg: TerminalBackground | null = null;
  private currentView: string | null = null;
  private currentUserId: string | null = null;

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
    const userId = authService.currentUser?._id || null;

    // Se não estiver autenticado, exibe a tela de login / hero
    if (!isAuthenticated) {
      if (this.currentView !== 'auth') {
        this.currentView = 'auth';
        this.currentUserId = null;
        const authHero = new AuthHeroView(this.contentEl);
        authHero.render();
      }
      return;
    }

    // Se mudou o usuário autenticado, força re-render
    const authChanged = this.currentUserId !== userId;
    this.currentUserId = userId;

    let targetView = 'dashboard';
    if (hash.startsWith('#/hangar')) targetView = 'hangar';
    else if (hash.startsWith('#/pilot')) targetView = 'pilot';
    else if (hash.startsWith('#/mech')) targetView = 'mech';
    else if (hash.startsWith('#/missions')) targetView = 'missions';
    else if (hash.startsWith('#/review')) targetView = 'review';

    if (!authChanged && this.currentView === targetView && targetView !== 'pilot' && targetView !== 'mech') {
      return;
    }
    this.currentView = targetView;

    // Rota do Hangar de Mechas
    if (targetView === 'hangar') {
      const hangarView = new HangarView(this.contentEl);
      hangarView.render();
      return;
    }

    // Rota da Ficha do Piloto / Operador
    if (targetView === 'pilot') {
      const searchParams = new URLSearchParams(hash.split('?')[1] || '');
      const pilotId = searchParams.get('id') || null;
      const sheetView = new PilotSheetView(this.contentEl, pilotId);
      sheetView.render();
      return;
    }

    // Rota da Ficha do Mecha / Chassi
    if (targetView === 'mech') {
      const searchParams = new URLSearchParams(hash.split('?')[1] || '');
      const pilotId = searchParams.get('id') || null;
      const mechView = new MechSheetView(this.contentEl, pilotId);
      mechView.render();
      return;
    }

    // Rota de Missões / Quadro de Operações
    if (targetView === 'missions') {
      const missionsView = new MissionsView(this.contentEl);
      missionsView.render();
      return;
    }

    // Rota de Avaliações / Homologação de Fichas (GM / ADMIN)
    if (targetView === 'review') {
      const reviewView = new ReviewView(this.contentEl);
      reviewView.render();
      return;
    }

    // Dashboard Padrão
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
                <a href="#/mech" class="btn btn-primary pilot-hero-btn">
                  ${getCompconIcon('mech', 'compcon-icon')}
                  <span>FICHA DO MECHA</span>
                </a>
                <a href="#/pilot" class="btn btn-secondary pilot-hero-btn">
                  ${getCompconIcon('pilot', 'compcon-icon')}
                  <span>FICHA DO PILOTO</span>
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



}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  const app = new OmninetApp();
  app.init();
});
