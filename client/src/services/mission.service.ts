import { ApiClient } from './api.js';
import { IMission } from '../types/mission.types.js';

export interface IMissionFilters {
  status?: string;
  min_ll?: number;
  max_ll?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IMissionsResponse {
  missions: IMission[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

class MissionService {
  /**
   * Lista missões com filtros opcionais
   */
  async getMissions(filters: IMissionFilters = {}): Promise<IMissionsResponse> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.min_ll !== undefined) params.set('min_ll', String(filters.min_ll));
    if (filters.max_ll !== undefined) params.set('max_ll', String(filters.max_ll));
    if (filters.search) params.set('search', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const query = params.toString() ? `?${params.toString()}` : '';
    return ApiClient.get<IMissionsResponse>(`/missions${query}`);
  }

  /**
   * Obtém detalhes completos de uma missão por ID
   */
  async getMissionById(id: string): Promise<IMission> {
    const data = await ApiClient.get<any>(`/missions/${id}`);
    return data.mission || data;
  }

  /**
   * Candidatar piloto à missão
   */
  async applyToMission(missionId: string, pilotId?: string): Promise<any> {
    return ApiClient.post(`/missions/${missionId}/apply`, pilotId ? { pilot_id: pilotId } : {});
  }

  /**
   * Cancelar candidatura
   */
  async cancelApplication(missionId: string): Promise<any> {
    return ApiClient.delete(`/missions/${missionId}/apply`);
  }

  /**
   * Criar nova missão (Apenas GMs e ADMINs)
   */
  async createMission(missionData: Partial<IMission>): Promise<IMission> {
    const data = await ApiClient.post<any>('/missions', missionData);
    return data.mission || data;
  }

  /**
   * Atualizar dados da missão (Apenas GM dono ou ADMIN)
   */
  async updateMission(id: string, missionData: Partial<IMission>): Promise<IMission> {
    const data = await ApiClient.put<any>(`/missions/${id}`, missionData);
    return data.mission || data;
  }

  /**
   * Escalar esquadrão da missão (Apenas GM dono ou ADMIN)
   */
  async selectPilots(
    missionId: string,
    selections: Array<{ pilot_id: string; status: 'SELECTED' | 'WAITLIST' | 'REJECTED' | 'PENDING' }>
  ): Promise<any> {
    return ApiClient.post(`/missions/${missionId}/select-pilots`, { selections });
  }

  /**
   * Iniciar missão (Muda status para IN_PROGRESS)
   */
  async startMission(id: string): Promise<any> {
    return ApiClient.post(`/missions/${id}/start`);
  }

  /**
   * Concluir missão
   */
  async completeMission(id: string, aar: string): Promise<any> {
    return ApiClient.post(`/missions/${id}/complete`, { aar });
  }

  /**
   * Excluir ou cancelar missão
   */
  async deleteMission(id: string): Promise<any> {
    return ApiClient.delete(`/missions/${id}`);
  }
}

export const missionService = new MissionService();
