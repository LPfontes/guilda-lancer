import { ApiClient } from './api.js';
import { IAuthSession, IUser, UserRole } from '../types/user.types.js';
import { IPilot } from '../types/pilot.types.js';
import { ToastService } from '../components/toast.js';

type AuthListener = (session: IAuthSession) => void;

/**
 * Gerenciador central de autenticação e sessão do Operador.
 */
class AuthService {
  private session: IAuthSession = {
    user: null,
    pilot: null,
    pilots: []
  };

  private listeners: Set<AuthListener> = new Set();
  public isInitialized = false;

  get currentSession(): IAuthSession {
    return this.session;
  }

  get currentUser(): IUser | null {
    return this.session.user;
  }

  get activePilot(): IPilot | null {
    return this.session.pilot;
  }

  get pilots(): IPilot[] {
    return this.session.pilots;
  }

  get isAuthenticated(): boolean {
    return Boolean(this.session.user);
  }

  get isGMOrAdmin(): boolean {
    const role = this.session.user?.role;
    return role === 'GM' || role === 'ADMIN';
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.session);
    return () => this.listeners.delete(listener);
  }

  updatePilots(pilots: IPilot[], activePilot?: IPilot | null) {
    this.session.pilots = pilots;
    if (activePilot !== undefined) {
      this.session.pilot = activePilot;
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.session);
      } catch (err) {
        console.error('[!] Erro no listener de autenticação:', err);
      }
    });
  }

  /**
   * Consulta a sessão ativa no servidor (/api/auth/me) usando os cookies de sessão.
   */
  async checkAuth(): Promise<IAuthSession> {
    try {
      const data = await ApiClient.get<IAuthSession>('/auth/me');
      this.session = {
        user: data.user || null,
        pilot: data.pilot || null,
        pilots: data.pilots || []
      };
    } catch {
      this.session = {
        user: null,
        pilot: null,
        pilots: []
      };
    } finally {
      this.isInitialized = true;
      this.notify();
    }
    return this.session;
  }

  /**
   * Redireciona o navegador para o fluxo oficial de autorização do Discord OAuth2.
   */
  async initiateDiscordLogin(): Promise<void> {
    try {
      // Solicita a URL gerada pelo servidor
      const res = await ApiClient.get<{ auth_url: string }>('/auth/discord/login');
      if (res?.auth_url) {
        window.location.href = res.auth_url;
      } else {
        // Fallback direto com redirect
        const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
        window.location.href = `${apiBase}/api/auth/discord/login?redirect=true`;
      }
    } catch (err: any) {
      ToastService.error(`Falha ao conectar com o gateway Discord: ${err.message}`);
    }
  }

  /**
   * Autenticação simulada para desenvolvimento rápido local via cookie HttpOnly.
   */
  async devLogin(role: UserRole = 'PILOT', username?: string): Promise<boolean> {
    try {
      const res = await ApiClient.post<{ user: IUser; message: string }>('/auth/dev-login', {
        role,
        username
      });

      // Limpeza preventiva caso houvesse token legado no localStorage
      localStorage.removeItem('omninet_token');

      ToastService.success(res.message || `Sessão iniciada como ${role}.`);
      await this.checkAuth();
      return true;
    } catch (err: any) {
      ToastService.error(`Falha no dev-login: ${err.message}`);
      return false;
    }
  }

  /**
   * Encerra a sessão ativa do terminal limpando o cookie HttpOnly no backend.
   */
  async logout(): Promise<void> {
    try {
      await ApiClient.post('/auth/logout');
      ToastService.info('Sessão de terminal encerrada. Até logo, operador.');
    } catch (err: any) {
      console.warn('[!] Erro ao enviar logout:', err);
    } finally {
      localStorage.removeItem('omninet_token');
      this.session = { user: null, pilot: null, pilots: [] };
      import('./pilot.service.js').then(m => m.pilotService.clearCache());
      this.notify();
    }
  }

  /**
   * Processa parâmetros de retorno após o redirecionamento OAuth2 do Discord.
   * O cookie de sessão HttpOnly já foi atribuído no redirecionamento pelo backend.
   */
  async processAuthCallback(): Promise<boolean> {
    const url = new URL(window.location.href);
    const error = url.searchParams.get('error');

    // Se estiver em formato hash: #/auth/callback?error=...
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const hashError = hashParams.get('error');
    const finalError = error || hashError;

    // Limpeza de segurança de token em localStorage se existente
    localStorage.removeItem('omninet_token');

    if (finalError) {
      ToastService.error(`Erro retornado pelo Discord: ${decodeURIComponent(finalError)}`);
      // Limpa os parâmetros da URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return false;
    }

    if (url.pathname.includes('/auth/callback') || url.hash.includes('/auth/callback')) {
      ToastService.info('Autenticação confirmada. Carregando registros do hangar...');
      await this.checkAuth();

      // Limpa query params e hash de callback
      window.history.replaceState({}, document.title, '/');
      return true;
    }

    return false;
  }
}

export const authService = new AuthService();
