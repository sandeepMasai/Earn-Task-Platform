import { apiService } from './api';

export interface AdminTask {
  id: string;
  type: string;
  title: string;
  description: string;
  coins: number;
  videoUrl?: string;
  videoDuration?: number;
  instagramUrl?: string;
  youtubeUrl?: string;
  thumbnail?: string;
  isActive: boolean;
  completionCount: number;
  totalCoinsGiven: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCompletion {
  userId: string;
  userName: string;
  userUsername: string;
  userEmail?: string;
  completedAt: string;
  coinsEarned: number;
}

export interface TaskDetails extends AdminTask {
  completions: TaskCompletion[];
}

export interface CreateTaskData {
  type: string;
  title: string;
  description: string;
  coins: number;
  videoUrl?: string;
  videoDuration?: number;
  instagramUrl?: string;
  youtubeUrl?: string;
  thumbnail?: string;
  isActive?: boolean;
}

export const adminTaskService = {
  async createTask(taskData: CreateTaskData): Promise<AdminTask> {
    const response = await apiService.post<AdminTask>('/admin/tasks', taskData);
    return response.data;
  },

  async getAllTasks(): Promise<AdminTask[]> {
    const response = await apiService.get<AdminTask[]>('/admin/tasks');
    return response.data as AdminTask[];
  },

  async getTaskById(taskId: string): Promise<TaskDetails> {
    const response = await apiService.get<TaskDetails>(`/admin/tasks/${taskId}`);
    return response.data as TaskDetails;
  },

  async updateTask(taskId: string, taskData: Partial<CreateTaskData>): Promise<AdminTask> {
    const response = await apiService.put<AdminTask>(`/admin/tasks/${taskId}`, taskData);
    return response.data;
  },

  async deleteTask(taskId: string): Promise<void> {
    await apiService.delete(`/admin/tasks/${taskId}`);
  },

  async getTaskCompletions(taskId: string): Promise<{
    taskId: string;
    taskTitle: string;
    completionCount: number;
    totalCoinsGiven: number;
    completions: TaskCompletion[];
  }> {
    const response = await apiService.get<{
      taskId: string;
      taskTitle: string;
      completionCount: number;
      totalCoinsGiven: number;
      completions: TaskCompletion[];
    }>(`/admin/tasks/${taskId}/completions`);
    return response.data;
  },
};

