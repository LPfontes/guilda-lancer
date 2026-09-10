import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';
import { localization } from '../services/localization.service.js';

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
              <span>${localization.t('auth.awaiting_credential', 'AGUARDANDO_CREDENCIAL')}</span>
            </div>
          </div>

          <!-- Corpo do Terminal -->
          <div class="terminal-box-body">
            <div class="terminal-brand-header">
              <h1 class="terminal-brand-title">${localization.t('auth.brand_title', 'GUILDA LANCER')}</h1>
              <div class="terminal-brand-sub">${localization.t('auth.brand_sub', 'SISTEMA TÁTICO OPERACIONAL')}</div>
            </div>

            <p class="terminal-description">
              ${localization.t(
                'auth.description',
                'Autentique sua conta do Discord para acessar o hangar de mechas, sincronizar fichas do COMP/CON e participar das operações da Guilda.'
              )}
            </p>

            <!-- Ação Principal de Login -->
            <div class="terminal-action-area">
              <button id="btn-discord-login" class="terminal-btn terminal-btn-discord" type="button">
                <i class="mdi mdi-discord discord-btn-icon"></i>
                <span>${localization.t('auth.discord_login', 'ENTRAR COM O DISCORD')}</span>
              </button>
            </div>
          </div>

          <!-- Rodapé do Box -->
          <div class="terminal-box-footer">
            <span>${localization.t('auth.terminal_host', 'TERMINAL: LOCALHOST')}</span>
            <span>${localization.t('auth.build', 'BUILD: v1.0.0')}</span>
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
  }
}

