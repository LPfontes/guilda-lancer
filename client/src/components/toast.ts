/**
 * Sistema de Toasts do Terminal.
 * Notificações técnicas, limpas e compactas.
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

export class ToastService {
  private static container: HTMLElement | null = null;
  private static recentToasts: Map<string, number> = new Map();

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

  static show(message: string, type: ToastType = 'info', durationMs: number = 3500) {
    const key = `${type}:${message.trim()}`;
    const now = Date.now();
    const lastTime = this.recentToasts.get(key) || 0;

    // Previne que o mesmo toast dispare mais de uma vez em um intervalo curto (800ms)
    if (now - lastTime < 800) {
      return;
    }
    this.recentToasts.set(key, now);
    setTimeout(() => {
      if (this.recentToasts.get(key) === now) {
        this.recentToasts.delete(key);
      }
    }, 1500);

    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap: Record<ToastType, string> = {
      info: 'mdi-information-outline',
      success: 'mdi-check-circle-outline',
      warning: 'mdi-alert-outline',
      error: 'mdi-close-octagon-outline'
    };

    toast.innerHTML = `
      <i class="mdi ${iconMap[type]} toast-icon"></i>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Fechar"><i class="mdi mdi-close"></i></button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', () => {
      toast.remove();
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('toast-fading');
        setTimeout(() => toast.remove(), 200);
      }
    }, durationMs);
  }

  static success(msg: string) {
    this.show(msg, 'success');
  }

  static error(msg: string) {
    this.show(msg, 'error', 5000);
  }

  static warning(msg: string) {
    this.show(msg, 'warning', 4000);
  }

  static info(msg: string) {
    this.show(msg, 'info');
  }
}
