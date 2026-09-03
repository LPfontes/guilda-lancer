import { ApiClient } from './api.js';
import { IPilot } from '../types/pilot.types.js';

export interface IPilotPreviewResult {
  parsed: any;
  tactical_summary: any;
  warnings?: string[];
  is_valid: boolean;
}

export interface IPilotSubmitResult {
  message: string;
  pilot: IPilot;
  tactical_summary: any;
  warnings?: string[];
  is_valid: boolean;
}

const PILOTS_CACHE_KEY = 'lancer_pilots_cache';

export class PilotService {
  /**
   * Limpa o cache local de pilotos.
   */
  clearCache(): void {
    localStorage.removeItem(PILOTS_CACHE_KEY);
  }

  /**
   * Obtém a lista de pilotos/chassis do operador autenticado.
   */
  async getMyPilots(forceRefresh = false): Promise<{ pilots: IPilot[]; active_pilot: IPilot | null }> {
    if (!forceRefresh) {
      const cached = localStorage.getItem(PILOTS_CACHE_KEY);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.warn('Falha ao decodificar cache local de pilotos', e);
        }
      }
    }

    const data = await ApiClient.get<{
      total: number;
      active_pilot: IPilot | null;
      pilots: IPilot[];
    }>('/pilots/me');

    const result = {
      pilots: data.pilots || [],
      active_pilot: data.active_pilot || null
    };

    localStorage.setItem(PILOTS_CACHE_KEY, JSON.stringify(result));
    return result;
  }

  /**
   * Obtém os detalhes completos de uma ficha de piloto por ID (para inspeção e auditoria).
   */
  async getPilotById(id: string): Promise<IPilot> {
    const data = await ApiClient.get<{ pilot: IPilot; tactical_summary?: any }>(`/pilots/${id}`);
    return data.pilot || (data as any);
  }

  /**
   * Gera uma prévia de validação da ficha COMP/CON sem persistir no banco.
   */
  async previewPilot(payload: {
    compcon_json?: string;
    share_code?: string;
    compcon_data?: any;
  }): Promise<IPilotPreviewResult> {
    return ApiClient.post<IPilotPreviewResult>('/pilots/preview', payload);
  }

  /**
   * Importa e persiste uma ficha do COMP/CON no banco de dados.
   */
  async submitPilot(payload: {
    compcon_json?: string;
    share_code?: string;
    compcon_data?: any;
    set_active?: boolean;
    pilot_id?: string;
  }): Promise<IPilotSubmitResult> {
    const res = await ApiClient.post<IPilotSubmitResult>('/pilots/submit', payload);
    this.clearCache();
    return res;
  }

  /**
   * Define um chassi/piloto como o ativo no hangar do operador.
   */
  async activatePilot(id: string): Promise<IPilot> {
    const res = await ApiClient.post<{ message: string; active_pilot: IPilot }>(
      `/pilots/${id}/activate`
    );
    this.clearCache();
    return res.active_pilot;
  }

  /**
   * Remove uma ficha de piloto do hangar do operador.
   */
  async deletePilot(id: string): Promise<void> {
    await ApiClient.delete(`/pilots/${id}`);
    this.clearCache();
  }

  /**
   * Lista todas as fichas com filtros (para GMs e ADMINs na aba de Avaliações).
   */
  async getAllPilots(filters: { status?: string; search?: string; page?: number; limit?: number } = {}): Promise<{
    pilots: IPilot[];
    pagination: { total: number; page: number; limit: number; total_pages: number };
  }> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const query = params.toString() ? `?${params.toString()}` : '';
    return ApiClient.get(`/pilots${query}`);
  }

  /**
   * Avalia uma ficha de piloto (APPROVED ou REJECTED com justificativa).
   */
  async reviewPilot(id: string, status: 'APPROVED' | 'REJECTED', rejection_reason?: string): Promise<{
    message: string;
    pilot: IPilot;
  }> {
    const res = await ApiClient.post<{ message: string; pilot: IPilot }>(`/pilots/${id}/review`, {
      status,
      rejection_reason
    });
    this.clearCache();
    return res;
  }
}

export const pilotService = new PilotService();
