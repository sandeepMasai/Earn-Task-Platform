import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@constants';
import { authStorage } from '@utils/storage';
import { ApiResponse } from '@types';
import { AuthRefresh } from './authRefresh';

export class ApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}
type AuthConfig = InternalAxiosRequestConfig & { _retry?: boolean; _authEpoch?: number };
const publicAuth = new Set(['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/verify-otp', '/auth/reset-password']);

class ApiService {
  private client: AxiosInstance;
  readonly auth: AuthRefresh;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.auth = new AuthRefresh({
      ...authStorage,
      clearAuth: () => authStorage.clearAuth(),
      request: async refreshToken => {
        const response = await this.client.post('/auth/refresh', { refreshToken });
        return response.data.data;
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config: AuthConfig) => {
        if (config._authEpoch !== undefined && config._authEpoch !== this.auth.epoch) throw new ApiError('Session ended', 401);
        config._authEpoch = this.auth.epoch;
        const token = await authStorage.getToken();
        if (config._authEpoch !== this.auth.epoch) throw new ApiError('Session ended', 401);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as AuthConfig | undefined;
        if (error.response?.status === 401 && config && !publicAuth.has(config.url || '')) {
          if (config._retry) {
            if (config._authEpoch === this.auth.epoch) await this.auth.logout();
          } else {
            config._retry = true;
            const authorization = String(config.headers.Authorization || '');
            const token = await this.auth.refresh(authorization.replace(/^Bearer /, ''), config._authEpoch ?? this.auth.epoch);
            config.headers.Authorization = `Bearer ${token}`;
            return this.client(config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get(url, { params });
      // Backend returns { success: true, data: ... }
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async post<T>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(url, data, config);
      if (response.data?.success) {
        const payloadData = response.data.data !== undefined ? response.data.data : response.data;
        return { success: true, ...response.data, data: payloadData };
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async put<T>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(url, data, config);
      // Backend returns { success: true, data: ... }
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete(url);
      // Backend returns { success: true, data: ... }
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.error || error.response.data?.message || 'An error occurred';
      return new ApiError(message, error.response.status);
    } else if (error.request) {
      // Request made but no response
      return new ApiError('Network error. Please check your connection.');
    } else {
      // Something else happened
      return new ApiError(error.message || 'An unexpected error occurred', error.status);
    }
  }
}

export const apiService = new ApiService();

