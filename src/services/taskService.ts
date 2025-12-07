import { apiService } from './api';
import { Task } from '@types';

export const taskService = {
  async getTasks(): Promise<Task[]> {
    const response = await apiService.get<Task[]>('/tasks');
    return response.data as Task[];
  },

  async getTaskById(taskId: string): Promise<Task> {
    const response = await apiService.get<Task>(`/tasks/${taskId}`);
    return response.data as Task;
  },

  async completeTask(taskId: string, data?: any): Promise<{ coins: number; message: string }> {
    const response = await apiService.post<{ coins: number; message: string }>(
      `/tasks/${taskId}/complete`,
      data
    );
    return response.data as { coins: number; message: string };
  },

  async verifyInstagramFollow(instagramUrl: string): Promise<boolean> {
    const response = await apiService.post<{ verified: boolean }>('/tasks/verify/instagram-follow', {
      instagramUrl,
    });
    return (response.data as { verified: boolean }).verified;
  },

  async verifyYouTubeSubscribe(youtubeUrl: string): Promise<boolean> {
    const response = await apiService.post<{ verified: boolean }>('/tasks/verify/youtube-subscribe', {
      youtubeUrl,
    });
    return (response.data as { verified: boolean }).verified;
  },
};

