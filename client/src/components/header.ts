import { authService } from '../services/auth.service.js';
import { IAuthSession } from '../types/user.types.js';

/**
 * Componente do Cabeçalho Tático Superior (Terminal Header).
 * Atualiza-se dinamicamente conforme a sessão do operador.
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
            <a href="#/hangar" id="nav-hangar" class="btn btn-secondary header-nav-btn">
              <span class="nav-icon">⬡</span>
              <span>HANGAR</span>
              <span class="nav-count-badge">${pilots.length}</span>
            </a>
            <a href="#/missions" id="nav-missions" class="btn btn-secondary header-nav-btn">
              <span class="nav-icon">◈</span>
              <span>MISSÕES</span>
            </a>
            ${
              user.role === 'GM' || user.role === 'ADMIN'
                ? `
              <a href="#/review" id="nav-review" class="btn btn-secondary header-nav-btn header-nav-special">
                <span class="nav-icon">▲</span>
                <span>AVALIAÇÕES</span>
              </a>
            `
                : ''
            }
          </nav>
        `
            : ''
        }
      </div>

      <div class="header-user-area">
        ${
          user
            ? `
          <div class="header-operator-card">
            ${
              user.avatar
                ? `<img class="header-avatar" src="${user.avatar}" alt="Avatar de ${user.username}" />`
                : `<div class="header-avatar-placeholder">${user.username.charAt(0).toUpperCase()}</div>`
            }
            <div class="header-user-info">
              <div class="header-callsign">
                ${pilot ? `[${pilot.callsign}]` : `@${user.username}`}
              </div>
              <div class="header-tags">
                <span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span>
                ${
                  pilot?.active_mech_frame
                    ? `<span class="mech-frame-tag" title="${pilot.active_mech_name || 'Mech'}">${pilot.active_mech_frame}</span>`
                    : ''
                }
              </div>
            </div>
          </div>

          <button id="btn-logout" class="btn btn-logout" title="Encerrar sessão no terminal">
            <span class="btn-logout-icon">⏻</span>
            <span>SAIR</span>
          </button>
        `
            : `
          <div class="header-locked-badge">
            <span class="signal-dot"></span>
            <span>TERMINAL BLOQUEADO // ACESSO RESTRITO</span>
          </div>
        `
        }
      </div>
    `;

    // Event listeners
    const logoutBtn = this.container.querySelector('#btn-logout');
    logoutBtn?.addEventListener('click', async () => {
      await authService.logout();
      window.location.hash = '#/';
    });
  }
}
