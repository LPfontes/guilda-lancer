/**
 * Sistema de Toasts Táticos do Terminal Omninet.
 * Exibe notificações com telemetria militar, scanlines e badges.
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

export class ToastService {
  private static container: HTMLElement | null = null;

  private static getContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  static show(message: string, type: ToastType = 'info', durationMs: number = 4000) {
    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap: Record<ToastType, string> = {
      info: '⬡',
      success: '✓',
      warning: '▲',
      error: '✕'
    };

    const labelMap: Record<ToastType, string> = {
      info: 'OMNINET // TRANSMISSÃO',
      success: 'OMNINET // SUCESSO',
      warning: 'OMNINET // AVISO',
      error: 'OMNINET // FALHA CRÍTICA'
    };

    toast.innerHTML = `
      <div class="toast-indicator">
        <span class="toast-symbol">${iconMap[type]}</span>
      </div>
      <div class="toast-body">
        <div class="toast-header">
          <span class="toast-label">${labelMap[type]}</span>
          <span class="toast-time">${new Date().toLocaleTimeString('pt-BR')}</span>
        </div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Fechar notificação">×</button>
      <div class="toast-progress-bar" style="animation-duration: ${durationMs}ms"></div>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', () => {
      this.dismiss(toast);
    });

    container.appendChild(toast);

    // Auto dismiss
    const timer = window.setTimeout(() => {
      this.dismiss(toast);
    }, durationMs);

    // Hover pauses dismissal
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
  }

  private static dismiss(toast: HTMLElement) {
    toast.classList.add('toast-dismissing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    }, { once: true });
  }

  static success(msg: string) {
    this.show(msg, 'success');
  }

  static error(msg: string) {
    this.show(msg, 'error', 5500);
  }

  static warning(msg: string) {
    this.show(msg, 'warning', 5000);
  }

  static info(msg: string) {
    this.show(msg, 'info');
  }
}
