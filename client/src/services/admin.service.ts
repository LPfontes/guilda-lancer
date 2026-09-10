import { ApiClient } from './api.js';
import { IUser, UserRole } from '../types/user.types.js';

export interface IAdminUserPilot {
  _id: string;
  callsign: string;
  license_level: number;
  is_active: boolean;
  active_mech_name?: string;
  status: string;
}

export interface IAdminUser extends Omit<IUser, 'pilots'> {
  pilots: IAdminUserPilot[];
}

export interface IAdminUsersResponse {
  users: IAdminUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  stats: {
    total: number;
    admins: number;
    gms: number;
    avaliadores: number;
    pilots: number;
  };
}

export class AdminService {
  /**
   * Consulta lista paginada de operadores com estatísticas.
   */
  async getUsers(params: { search?: string; role?: string; page?: number; limit?: number } = {}): Promise<IAdminUsersResponse> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const endpoint = `/admin/users${qs ? `?${qs}` : ''}`;
    return ApiClient.get<IAdminUsersResponse>(endpoint);
  }

  /**
   * Atualiza os cargos (roles) atribuídos a um operador.
   */
  async updateUserRoles(userId: string, roles: UserRole[]): Promise<{ message: string; user: IUser }> {
    return ApiClient.patch<{ message: string; user: IUser }>(`/admin/users/${userId}/roles`, { roles });
  }

  /**
   * Atualiza dados de perfil do operador (nome de exibição e apelido).
   */
  async updateUserProfile(userId: string, data: { name?: string; nickname?: string }): Promise<{ message: string; user: IUser }> {
    return ApiClient.patch<{ message: string; user: IUser }>(`/admin/users/${userId}/profile`, data);
  }

  /**
   * Exclui permanentemente o operador e seus pilotos associados.
   */
  async deleteUser(userId: string): Promise<{ message: string }> {
    return ApiClient.delete<{ message: string }>(`/admin/users/${userId}`);
  }
}

export const adminService = new AdminService();
