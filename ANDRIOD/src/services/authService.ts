import { apiService } from './api';
import { authStorage } from '@utils/storage';
import { LoginResponse, SignupResponse, User } from '@types';

export const authService = {
  async forgotPassword(email: string): Promise<void> {
    await apiService.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
  },

  async verifyOtp(email: string, code: string): Promise<{ resetToken: string }> {
    const response = await apiService.post<{ resetToken?: string }>('/auth/verify-otp', {
      email: email.trim().toLowerCase(),
      code: code.trim(),
    });
    const resetToken = response?.data?.resetToken || (response as any)?.resetToken;
    if (!resetToken) {
      throw new Error('Verification failed: No reset token received');
    }
    return { resetToken };
  },

  async resetPassword(email: string, resetTokenOrNewPassword: string, newPasswordOrResetToken?: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    let resetToken: string | undefined;
    let newPassword: string | undefined;

    if (!newPasswordOrResetToken) {
      throw new Error('Reset token and new password are required');
    }

    // Support (email, resetToken, newPassword) and (email, newPassword, resetToken)
    if (resetTokenOrNewPassword.length === 64 || resetTokenOrNewPassword.toLowerCase().includes('token')) {
      resetToken = resetTokenOrNewPassword;
      newPassword = newPasswordOrResetToken;
    } else if (newPasswordOrResetToken.length === 64 || newPasswordOrResetToken.toLowerCase().includes('token')) {
      newPassword = resetTokenOrNewPassword;
      resetToken = newPasswordOrResetToken;
    } else {
      resetToken = resetTokenOrNewPassword;
      newPassword = newPasswordOrResetToken;
    }

    if (!resetToken) {
      throw new Error('Verification expired. Please request a new OTP.');
    }

    await apiService.post('/auth/reset-password', {
      email: cleanEmail,
      resetToken,
      newPassword,
    });
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await apiService.post<LoginResponse>('/auth/login', {
        email,
        password,
      });
      const payload = response.data as LoginResponse;
      await authStorage.saveToken(payload.accessToken);
      await authStorage.saveRefreshToken(payload.refreshToken);
      if (payload.expiresAt) {
        await authStorage.saveExpiry(payload.expiresAt);
      }
      await authStorage.saveUser(payload.user);
      return payload;
    } catch (error: any) {
      throw error;
    }
  },

  async signup(
    email: string,
    password: string,
    name: string,
    username: string,
    referralCode?: string
  ): Promise<void> {
    // Registration creates the account; only an explicit login starts a session.
    await apiService.post<SignupResponse>('/auth/signup', {
      email,
      password,
      name,
      username,
      referralCode,
    });
  },

  async logout(): Promise<void> {
    // End the local session immediately, including any refresh in flight.
    const request = apiService.post('/auth/logout').catch(() => {});
    await apiService.auth.logout();
    await request;
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
    avatar?: string | null;
    mediaId?: string;
  }): Promise<User> {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.email !== undefined) payload.email = data.email.trim().toLowerCase();
    if (data.username !== undefined) payload.username = data.username.trim().toLowerCase();
    if (data.mediaId !== undefined) payload.mediaId = data.mediaId;
    else if (data.avatar !== undefined) payload.avatar = data.avatar;

    const response = await apiService.put<{ user: User }>('/auth/profile', payload);

    // ApiService unwraps to { success, data }, so handle both shapes defensively
    const updatedUser = (response as any).data?.user ?? (response as any).data ?? response;
    await authStorage.saveUser(updatedUser as User);
    return updatedUser as User;
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiService.put('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  },
};

