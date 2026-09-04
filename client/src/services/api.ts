const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Cliente HTTP base para comunicação com o Omninet Hub Backend.
 */
export class ApiClient {
  private static baseUrl = `${API_BASE}/api`;

  static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const config: RequestInit = {
      ...options,
      headers: defaultHeaders,
      credentials: 'include' // Envia automaticamente os cookies HttpOnly da sessão
    };

    const response = await fetch(url, config);

    let data: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `HTTP Error ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  static get<T = any>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  static post<T = any>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers
    });
  }

  static put<T = any>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers
    });
  }

  static patch<T = any>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers
    });
  }

  static delete<T = any>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}
