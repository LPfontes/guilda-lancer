import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';

/**
 * Tela de Autenticação / Entrada do Terminal da Guilda.
 * Design técnico e utilitário inspirado no COMP/CON e na estética industrial do LANCER RPG.
 */
export class AuthHeroView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render() {
    this.container.innerHTML = `
      <div class="auth-terminal-wrapper">
        <div class="terminal-box">
          <!-- Barra de Topo Técnica -->
          <div class="terminal-box-header">
            <div class="terminal-box-title">
              <span class="terminal-bracket">[</span>
              <span class="terminal-id">LNC://TERMINAL_AUTH</span>
              <span class="terminal-bracket">]</span>
            </div>
            <div class="terminal-status-indicator">
              <span class="status-box-indicator"></span>
              <span>AGUARDANDO_CREDENCIAL</span>
            </div>
          </div>

          <!-- Corpo do Terminal -->
          <div class="terminal-box-body">
            <div class="terminal-brand-header">
              <h1 class="terminal-brand-title">GUILDA LANCER</h1>
              <div class="terminal-brand-sub">SISTEMA TÁTICO OPERACIONAL</div>
            </div>

            <p class="terminal-description">
              Autentique sua conta do Discord para acessar o hangar de mechas, sincronizar fichas do COMP/CON e participar das operações da Guilda.
            </p>

            <!-- Ação Principal de Login -->
            <div class="terminal-action-area">
              <button id="btn-discord-login" class="terminal-btn terminal-btn-discord" type="button">
                <i class="mdi mdi-discord discord-btn-icon"></i>
                <span>ENTRAR COM O DISCORD</span>
              </button>
            </div>

            <!-- Separador Técnico -->
            <div class="terminal-divider">
              <span class="divider-line"></span>
              <span class="divider-tag">ACESSO LOCAL (DEV)</span>
              <span class="divider-line"></span>
            </div>

            <!-- Seleção de Acesso Dev -->
            <div class="terminal-dev-grid">
              <button id="btn-dev-pilot" class="dev-quick-btn" type="button">
                ${getCompconIcon('pilot', 'compcon-icon dev-icon dev-icon-pilot')}
                <span class="dev-quick-role">PILOTO</span>
                <span class="dev-quick-sub">@operador_piloto</span>
              </button>
              <button id="btn-dev-gm" class="dev-quick-btn dev-quick-gm" type="button">
                ${getCompconIcon('review', 'compcon-icon dev-icon dev-icon-gm')}
                <span class="dev-quick-role">MESTRE</span>
                <span class="dev-quick-sub">@mestre_operacoes</span>
              </button>
              <button id="btn-dev-admin" class="dev-quick-btn dev-quick-admin" type="button">
                ${getCompconIcon('missions', 'compcon-icon dev-icon dev-icon-admin')}
                <span class="dev-quick-role">ADMIN</span>
                <span class="dev-quick-sub">@admin_omninet</span>
              </button>
            </div>
          </div>

          <!-- Rodapé do Box -->
          <div class="terminal-box-footer">
            <span>TERMINAL: LOCALHOST</span>
            <span>BUILD: v1.0.0</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    // Botão Discord OAuth2
    const discordBtn = this.container.querySelector('#btn-discord-login');
    discordBtn?.addEventListener('click', async () => {
      ToastService.info('Conectando ao Discord...');
      await authService.initiateDiscordLogin();
    });

    // Dev login Piloto
    const devPilotBtn = this.container.querySelector('#btn-dev-pilot');
    devPilotBtn?.addEventListener('click', async () => {
      const ok = await authService.devLogin('PILOT', 'piloto_teste');
      if (ok) window.location.hash = '#/hangar';
    });

    // Dev login Mestre
    const devGmBtn = this.container.querySelector('#btn-dev-gm');
    devGmBtn?.addEventListener('click', async () => {
      const ok = await authService.devLogin('GM', 'mestre_vanguard');
      if (ok) window.location.hash = '#/missions';
    });

    // Dev login Admin
    const devAdminBtn = this.container.querySelector('#btn-dev-admin');
    devAdminBtn?.addEventListener('click', async () => {
      const ok = await authService.devLogin('ADMIN', 'comandante_admin');
      if (ok) window.location.hash = '#/hangar';
    });
  }
}
