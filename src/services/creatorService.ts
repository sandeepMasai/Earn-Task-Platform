import { apiService } from './api';

export interface CreatorDashboard {
  creatorWallet: number;
  stats: {
    totalTasks: number;
    activeTasks: number;
    totalCompletions: number;
    totalCoinsSpent: number;
    uniqueUsers: number;
    youtubeSubscribers: number;
    totalWatchTime: number; // in seconds
  };
  links: {
    youtubeUrl: string | null;
    instagramUrl: string | null;
  };
  recentCompletions: Array<{
    taskTitle: string;
    taskType: string;
    userName: string;
    userUsername: string;
    completedAt: string;
  }>;
}

export interface CreatorCoinRequest {
  id: string;
  coins: number;
  amount: number;
  paymentProof: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  reviewedBy?: {
    id: string;
    name: string;
    username: string;
  } | null;
  reviewedAt?: string | null;
  requestedAt: string;
}

export const creatorService = {
  async registerAsCreator(youtubeUrl?: string, instagramUrl?: string): Promise<{ message: string; creatorStatus: string }> {
    const response = await apiService.post('/creator/register', {
      youtubeUrl,
      instagramUrl,
    });
    return response.data;
  },

  async getCreatorDashboard(): Promise<CreatorDashboard> {
    const response = await apiService.get('/creator/dashboard');
    return response.data;
  },

  async requestCoins(coins: number, paymentProofUri: string): Promise<{ message: string; requestId: string; coins: number; amount: number }> {
    const formData = new FormData();
    formData.append('coins', coins.toString());
    formData.append('paymentProof', {
      uri: paymentProofUri,
      type: 'image/jpeg',
      name: 'payment.jpg',
    } as any);

    const response = await apiService.post('/creator/request-coins', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getCoinRequests(): Promise<CreatorCoinRequest[]> {
    const response = await apiService.get('/creator/coin-requests');
    return response.data.map((req: any) => ({
      ...req,
      id: req._id || req.id,
    }));
  },

  async createTask(taskData: {
    type: string;
    title: string;
    description: string;
    rewardPerUser: number;
    maxUsers: number;
    videoUrl?: string;
    videoDuration?: number;
    instagramUrl?: string;
    youtubeUrl?: string;
    thumbnail?: string;
  }): Promise<{
    id: string;
    creatorWallet: number;
    totalBudget: number;
  }> {
    const response = await apiService.post('/creator/tasks', taskData);
    return response.data;
  },

  async getCreatorRequestHistory(): Promise<{
    isCreator: boolean;
    creatorStatus: 'pending' | 'approved' | 'rejected' | null;
    creatorApprovedBy?: {
      id: string;
      name: string;
      username: string;
    } | null;
    creatorApprovedAt?: string | null;
    creatorYouTubeUrl?: string | null;
    creatorInstagramUrl?: string | null;
    requestedAt?: string;
  }> {
    const response = await apiService.get('/creator/request-history');
    return response.data;
  },

  async getTaskSubmissions(status?: string, taskId?: string): Promise<Array<{
    id: string;
    task: {
      id: string;
      type: string;
      title: string;
      coins: number;
      instagramUrl?: string;
      youtubeUrl?: string;
    };
    user: {
      id: string;
      name: string;
      username: string;
      email: string;
    };
    proofImage: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    submittedAt: string;
  }>> {
    const params: any = {};
    if (status) params.status = status;
    if (taskId) params.taskId = taskId;
    const response = await apiService.get('/creator/task-submissions', params);
    return response.data.map((sub: any) => ({
      ...sub,
      id: sub._id || sub.id,
    }));
  },

  async getTaskSubmissionById(submissionId: string): Promise<{
    id: string;
    task: {
      id: string;
      type: string;
      title: string;
      description: string;
      coins: number;
      instagramUrl?: string;
      youtubeUrl?: string;
    };
    user: {
      id: string;
      name: string;
      username: string;
      email: string;
      coins: number;
    };
    proofImage: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string | null;
    reviewedBy?: {
      id: string;
      name: string;
      username: string;
    } | null;
    reviewedAt?: string | null;
    submittedAt: string;
  }> {
    const response = await apiService.get(`/creator/task-submissions/${submissionId}`);
    return {
      ...response.data,
      id: response.data._id || response.data.id,
    };
  },

  async approveTaskSubmission(submissionId: string): Promise<{ message: string; coins: number }> {
    const response = await apiService.put(`/creator/task-submissions/${submissionId}/approve`);
    return response.data;
  },

  async rejectTaskSubmission(submissionId: string, rejectionReason?: string): Promise<{ message: string }> {
    const response = await apiService.put(`/creator/task-submissions/${submissionId}/reject`, {
      rejectionReason,
    });
    return response.data;
  },
};

