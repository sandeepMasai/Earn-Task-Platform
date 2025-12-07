import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL } from '@constants';
import { authStorage } from '@utils/storage';
import { ApiResponse } from '@types';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await authStorage.getToken();
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
        if (error.response?.status === 401) {
          // Token expired or invalid
          await authStorage.clearAuth();
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    try {
      console.log('API GET:', `${this.client.defaults.baseURL}${url}`, params);
      const response = await this.client.get(url, { params });
      console.log('API Response:', response.status, response.data);
      // Backend returns { success: true, data: ... }
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return response.data;
    } catch (error) {
      console.error('API GET Error:', error);
      throw this.handleError(error);
    }
  }

  async post<T>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    try {
      console.log('API POST:', `${this.client.defaults.baseURL}${url}`, data);
      const response = await this.client.post(url, data, config);
      console.log('API Response:', response.status, response.data);
      // Backend returns { success: true, data: ... }
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return response.data;
    } catch (error) {
      console.error('API POST Error:', error);
      throw this.handleError(error);
    }
  }

  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(url, data);
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
    console.log('API Error:', error);
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.error || error.response.data?.message || 'An error occurred';
      console.log('Server error:', message, error.response.status);
      return new Error(message);
    } else if (error.request) {
      // Request made but no response
      console.log('Network error - no response:', error.request);
      console.log('API Base URL:', API_BASE_URL);
      return new Error(`Network error. Cannot connect to server at ${API_BASE_URL}. Please check if backend is running.`);
    } else {
      // Something else happened
      console.log('Request setup error:', error.message);
      return new Error(error.message || 'An unexpected error occurred');
    }
  }
}

export const apiService = new ApiService();

