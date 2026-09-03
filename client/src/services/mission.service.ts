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
  private baseUrl = '/api/missions';

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
    const res = await fetch(`${this.baseUrl}${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao carregar lista de operações da Omninet.');
    }

    return res.json();
  }

  /**
   * Obtém detalhes completos de uma missão por ID
   */
  async getMissionById(id: string): Promise<IMission> {
    const res = await fetch(`${this.baseUrl}/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Missão não encontrada.');
    }

    const data = await res.json();
    return data.mission || data;
  }

  /**
   * Candidatar piloto à missão
   */
  async applyToMission(missionId: string, pilotId?: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${missionId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pilotId ? { pilot_id: pilotId } : {})
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Falha ao submeter candidatura para a operação.');
    }

    return data;
  }

  /**
   * Cancelar candidatura
   */
  async cancelApplication(missionId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${missionId}/apply`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Falha ao cancelar candidatura na operação.');
    }

    return data;
  }

  /**
   * Criar nova missão (Apenas GMs e ADMINs)
   */
  async createMission(missionData: Partial<IMission>): Promise<IMission> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missionData)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Falha ao criar nova missão.');
    }

    return data.mission;
  }

  /**
   * Escalar esquadrão da missão (Apenas GM dono ou ADMIN)
   */
  async selectPilots(
    missionId: string,
    selections: Array<{ pilot_id: string; status: 'SELECTED' | 'WAITLIST' | 'REJECTED' | 'PENDING' }>
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${missionId}/select-pilots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Falha ao atualizar escalação do esquadrão.');
    }

    return data;
  }

  /**
   * Iniciar missão (Muda status para IN_PROGRESS)
   */
  async startMission(id: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Falha ao iniciar missão.');
    }

    return data;
  }

  /**
   * Concluir missão
   */
  async completeMission(id: string, aar: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aar })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Falha ao concluir missão.');
    }

    return data;
  }

  /**
   * Excluir ou cancelar missão
   */
  async deleteMission(id: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Falha ao cancelar missão.');
    }

    return data;
  }
}

export const missionService = new MissionService();
