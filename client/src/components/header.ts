import { authService } from '../services/auth.service.js';
import { IAuthSession } from '../types/user.types.js';
import { getCompconIcon } from './compcon-icons.js';

/**
 * Componente do Cabeçalho Superior (Terminal Header).
 * Estilo utilitário, industrial e minimalista com ícones oficiais do COMP/CON.
 */
export class HeaderComponent {
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(containerId: string = 'main-header') {
    this.container = document.getElementById(containerId);
  }

  mount() {
    if (!this.container) return;
    this.unsubscribe = authService.subscribe((session) => {
      this.render(session);
    });
  }

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private render(session: IAuthSession) {
    if (!this.container) return;

    const { user, pilot, pilots } = session;

    this.container.innerHTML = `
      <div class="header-nav-container">
        ${
          user
            ? `
          <nav class="header-nav" aria-label="Navegação Principal">
            <a href="#/hangar" id="nav-hangar" class="header-nav-link">
              ${getCompconIcon('hangar', 'compcon-icon')}
              <span>HANGAR</span>
              <span class="header-nav-badge">${pilots.length}</span>
            </a>
            <a href="#/pilot" id="nav-pilot" class="header-nav-link">
              ${getCompconIcon('pilot', 'compcon-icon')}
              <span>PILOTO</span>
            </a>
            <a href="#/missions" id="nav-missions" class="header-nav-link">
              ${getCompconIcon('missions', 'compcon-icon')}
              <span>MISSÕES</span>
            </a>
            <a href="#/reports" id="nav-reports" class="header-nav-link">
              <i class="mdi mdi-clipboard-text-outline"></i>
              <span>RELATÓRIOS</span>
            </a>
            <a href="#/review" id="nav-review" class="header-nav-link">
              ${getCompconIcon('review', 'compcon-icon')}
              <span>AVALIAÇÕES</span>
            </a>
          </nav>
        `
            : ''
        }
      </div>

      <div class="header-user-area">
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
            <span>SAIR</span>
          </button>
        `
            : `
          <div class="header-locked-indicator">
            <i class="mdi mdi-lock-outline"></i>
            <span>ACESSO RESTRITO</span>
          </div>
        `
        }
      </div>
    `;

    // Event listener
    const logoutBtn = this.container.querySelector('#btn-logout');
    logoutBtn?.addEventListener('click', async () => {
      await authService.logout();
      window.location.hash = '#/';
    });
  }
}
