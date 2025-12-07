import { apiService } from './api';
import { LoginResponse, SignupResponse, User } from '@types';

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      console.log('🔐 Attempting login for:', email);
      const response = await apiService.post<LoginResponse>('/auth/login', {
        email,
        password,
      });
      console.log('✅ Login successful');
      // Backend returns { user, token } in data
      return response.data as LoginResponse;
    } catch (error: any) {
      console.error('❌ Login error:', error.message);
      throw error;
    }
  },

  async signup(
    email: string,
    password: string,
    name: string,
    username: string,
    referralCode?: string
  ): Promise<SignupResponse> {
    try {
      console.log('📝 Attempting signup for:', email, username);
      const response = await apiService.post<SignupResponse>('/auth/signup', {
        email,
        password,
        name,
        username,
        referralCode,
      });
      console.log('✅ Signup successful');
      // Backend returns { user, token } in data
      return response.data as SignupResponse;
    } catch (error: any) {
      console.error('❌ Signup error:', error.message);
      throw error;
    }
  },

  async logout(): Promise<void> {
    await apiService.post('/auth/logout');
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiService.get<{ user: User }>('/auth/me');
    return response.data.user;
  },

  async updateInstagramId(instagramId: string): Promise<User> {
    const response = await apiService.put<{ user: User }>('/auth/instagram-id', {
      instagramId,
    });
    return response.data.user;
  },
};

