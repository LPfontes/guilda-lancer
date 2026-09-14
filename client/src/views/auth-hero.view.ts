import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';
import { localization } from '../services/localization.service.js';
import { areCookiesEnabled } from '../utils/cookie-check.js';

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
    const cookiesActive = areCookiesEnabled();

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
            <div class="terminal-status-indicator ${cookiesActive ? '' : 'error'}">
              <span class="status-box-indicator ${cookiesActive ? '' : 'error'}"></span>
              <span>${
                cookiesActive
                  ? localization.t('auth.awaiting_credential', 'AGUARDANDO_CREDENCIAL')
                  : localization.t('auth.cookies_disabled', 'COOKIES_DESATIVADOS')
              }</span>
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

            ${
              !cookiesActive
                ? `
              <!-- Painel de Alerta de Cookies Desativados -->
              <div class="cookie-alert-panel" id="cookie-alert-panel">
                <div class="cookie-alert-header">
                  <i class="mdi mdi-cookie-alert cookie-alert-icon"></i>
                  <div class="cookie-alert-title-wrap">
                    <span class="cookie-alert-tag">// FALHA DE TELEMETRIA LOCAL</span>
                    <h3 class="cookie-alert-title">${localization.t(
                      'auth.cookies_required_title',
                      'COOKIES DESATIVADOS NO NAVEGADOR'
                    )}</h3>
                  </div>
                </div>
                <p class="cookie-alert-desc">
                  ${localization.t(
                    'auth.cookies_required_desc',
                    'O Terminal requer cookies ativos para armazenar a sua chave de sessão segura (HttpOnly). Sem cookies habilitados, o login com o Discord não poderá ser concluído.'
                  )}
                </p>
                <div class="cookie-instructions">
                  <div class="cookie-inst-step">
                    <span class="cookie-step-badge">01</span>
                    <span>${localization.t(
                      'auth.cookie_step_1',
                      'Clique no ícone de <strong>Cadeado / Escudo / Permissões</strong> na barra de endereços do navegador.'
                    )}</span>
                  </div>
                  <div class="cookie-inst-step">
                    <span class="cookie-step-badge">02</span>
                    <span>${localization.t(
                      'auth.cookie_step_2',
                      'Permita os <strong>Cookies</strong> para este site e autorize cookies entre sites/origens.'
                    )}</span>
                  </div>
                  <div class="cookie-inst-step">
                    <span class="cookie-step-badge">03</span>
                    <span>${localization.t(
                      'auth.cookie_step_3',
                      'Clique no botão abaixo para revalidar a telemetria e desbloquear o acesso.'
                    )}</span>
                  </div>
                </div>
                <div class="cookie-alert-actions">
                  <button type="button" id="btn-recheck-cookies" class="cookie-recheck-btn">
                    <i class="mdi mdi-refresh"></i>
                    <span>${localization.t('auth.cookie_recheck', 'REVERIFICAR & ATUALIZAR')}</span>
                  </button>
                </div>
              </div>
            `
                : ''
            }

            <!-- Ação Principal de Login -->
            <div class="terminal-action-area">
              <button id="btn-discord-login" class="terminal-btn terminal-btn-discord ${cookiesActive ? '' : 'is-disabled'}" type="button">
                <i class="mdi ${cookiesActive ? 'mdi-discord' : 'mdi-lock-alert'} discord-btn-icon"></i>
                <span>${
                  cookiesActive
                    ? localization.t('auth.discord_login', 'ENTRAR COM O DISCORD')
                    : localization.t('auth.discord_login_locked', 'ENTRAR COM O DISCORD (REQUER COOKIES)')
                }</span>
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
    // Botão de Revalidação de Cookies
    const recheckBtn = this.container.querySelector('#btn-recheck-cookies');
    recheckBtn?.addEventListener('click', () => {
      const activeNow = areCookiesEnabled();
      if (activeNow) {
        ToastService.success('Cookies ativos detectados! Terminal desbloqueado para autenticação.');
        this.render();
      } else {
        ToastService.error('Cookies continuam desativados ou bloqueados pelo navegador.');
      }
    });

    // Botão Discord OAuth2
    const discordBtn = this.container.querySelector('#btn-discord-login');
    discordBtn?.addEventListener('click', async () => {
      if (!areCookiesEnabled()) {
        ToastService.error('Cookies desativados! Por favor, habilite os cookies no navegador para conseguir fazer login.');
        const alertPanel = this.container.querySelector('#cookie-alert-panel');
        alertPanel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      ToastService.info('Conectando ao Discord...');
      await authService.initiateDiscordLogin();
    });
  }
}


