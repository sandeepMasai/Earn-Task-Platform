import { apiService } from './api';
import { User } from '@types';

export const userService = {
  async getUserById(userId: string): Promise<User> {
    const response = await apiService.get<{ data: { user: User } }>(`/auth/user/${userId}`);
    return response.data.user;
  },
};

