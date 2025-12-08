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

  async updateProfile(data: {
    name?: string;
    email?: string;
    username?: string;
    avatar?: string;
  }): Promise<User> {
    const formData = new FormData();
    
    if (data.name) formData.append('name', data.name);
    if (data.email) formData.append('email', data.email);
    if (data.username) formData.append('username', data.username);
    if (data.avatar && typeof data.avatar === 'string') {
      formData.append('avatar', data.avatar);
    } else if (data.avatar && typeof data.avatar === 'object') {
      // If avatar is a file object
      formData.append('avatar', data.avatar as any);
    }

    const response = await apiService.put<{ user: User }>('/auth/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.user;
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiService.put('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  },
};

