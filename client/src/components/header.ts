import { authService } from '../services/auth.service.js';
import { localization } from '../services/localization.service.js';
import { IAuthSession } from '../types/user.types.js';
import { getCompconIcon } from './compcon-icons.js';

/**
 * Componente do Cabeçalho Superior (Terminal Header).
 * Estilo utilitário, industrial e minimalista com ícones oficiais do COMP/CON e alternador de idioma.
 */
export class HeaderComponent {
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeLang: (() => void) | null = null;

  constructor(containerId: string = 'main-header') {
    this.container = document.getElementById(containerId);
  }

  mount() {
    if (!this.container) return;
    this.unsubscribe = authService.subscribe((session) => {
      this.render(session);
    });
    this.unsubscribeLang = localization.subscribe(() => {
      this.render(authService.currentSession);
    });
  }

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.unsubscribeLang) {
      this.unsubscribeLang();
      this.unsubscribeLang = null;
    }
  }

  private render(session: IAuthSession) {
    if (!this.container) return;

    const { user, pilot, pilots } = session;
    const currentLang = localization.getLanguage();

    this.container.innerHTML = `
      <div class="header-nav-container">
        ${
          user
            ? `
          <nav class="header-nav" aria-label="Navegação Principal">
            <a href="#/hangar" id="nav-hangar" class="header-nav-link">
              ${getCompconIcon('hangar', 'compcon-icon')}
              <span>${localization.t('nav.hangar', 'HANGAR')}</span>
              <span class="header-nav-badge">${pilots.length}</span>
            </a>
            <a href="#/pilot" id="nav-pilot" class="header-nav-link">
              ${getCompconIcon('pilot', 'compcon-icon')}
              <span>${localization.t('nav.pilot', 'PILOTO')}</span>
            </a>
            <a href="#/missions" id="nav-missions" class="header-nav-link">
              ${getCompconIcon('missions', 'compcon-icon')}
              <span>${localization.t('nav.missions', 'MISSÕES')}</span>
            </a>
            <a href="#/reports" id="nav-reports" class="header-nav-link">
              <i class="mdi mdi-clipboard-text-outline"></i>
              <span>${localization.t('nav.reports', 'RELATÓRIOS')}</span>
            </a>
            <a href="#/review" id="nav-review" class="header-nav-link">
              ${getCompconIcon('review', 'compcon-icon')}
              <span>${localization.t('nav.review', 'AVALIAÇÕES')}</span>
            </a>
          </nav>
        `
            : ''
        }
      </div>

      <div class="header-user-area">
        <button id="btn-toggle-lang"
                type="button"
                class="header-lang-btn"
                title="${localization.t('nav.lang_switch', currentLang === 'pt' ? 'Mudar para Inglês (Desativar tradução)' : 'Mudar para Português (Ativar tradução)')}">
          <i class="mdi mdi-translate"></i>
          <span class="header-lang-code">${currentLang.toUpperCase()}</span>
        </button>

        ${
          user
            ? `
          <div class="header-operator-info">
            ${getCompconIcon('pilot', 'compcon-icon header-operator-icon')}
            <span class="header-operator-name">
              ${pilot ? pilot.callsign : `@${user.username}`}
            </span>
            <span class="header-role-badge role-${user.role.toLowerCase()}">${user.role}</span>
          </div>

          <button id="btn-logout" class="header-logout-btn" title="Encerrar sessão">
            <i class="mdi mdi-logout-variant"></i>
            <span>${localization.t('nav.logout', 'SAIR')}</span>
          </button>
        `
            : `
          <div class="header-locked-indicator">
            <i class="mdi mdi-lock-outline"></i>
            <span>${localization.t('nav.restricted', 'ACESSO RESTRITO')}</span>
          </div>
        `
        }
      </div>
    `;

    // Event listener para alternar idioma
    const langBtn = this.container.querySelector('#btn-toggle-lang');
    langBtn?.addEventListener('click', () => {
      localization.toggleLanguage();
    });

    // Event listener para logout
    const logoutBtn = this.container.querySelector('#btn-logout');
    logoutBtn?.addEventListener('click', async () => {
      await authService.logout();
      window.location.hash = '#/';
    });
  }
}
