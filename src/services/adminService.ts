import { apiService } from './api';

export interface DashboardStats {
  stats: {
    users: {
      total: number;
      active: number;
      blocked: number;
    };
    withdrawals: {
      total: number;
      pending: number;
      approved: number;
      totalAmount: number;
      byStatus: Array<{ _id: string; total: number; count: number }>;
    };
    transactions: number;
    tasks: number;
    posts: number;
  };
  recentWithdrawals: Withdrawal[];
  recentUsers: AdminUser[];
}

export interface Withdrawal {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
    coins?: number;
  };
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  paymentMethod: string;
  accountDetails: string;
  createdAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  coins: number;
  totalEarned: number;
  totalWithdrawn: number;
  isActive: boolean;
  createdAt: string;
  referralCode?: string;
  updatedAt?: string;
  role?: 'user' | 'admin';
}

export const adminService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiService.get<any>('/admin/dashboard');
    const data = response.data as any;

    // Transform _id to id for withdrawals and users
    const recentWithdrawals = ((data.recentWithdrawals || []) as any[]).map((w: any) => ({
      ...w,
      id: w._id || w.id,
      user: {
        ...w.user,
        id: w.user?._id || w.user?.id,
      },
    }));

    const recentUsers = ((data.recentUsers || []) as any[]).map((u: any) => ({
      ...u,
      id: u._id || u.id,
    }));

    return {
      stats: data.stats,
      recentWithdrawals,
      recentUsers,
    };
  },

  async getAllPayments(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    withdrawals: Withdrawal[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await apiService.get<{ withdrawals: any[]; pagination: any }>(`/admin/payments?${queryParams.toString()}`);

    // Transform _id to id
    const withdrawals = ((response.data as any).withdrawals || []).map((w: any) => ({
      ...w,
      id: w._id || w.id,
      user: {
        ...w.user,
        id: w.user?._id || w.user?.id,
      },
    }));

    return {
      withdrawals,
      pagination: (response.data as any).pagination,
    };
  },

  async updatePaymentStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected' | 'completed',
    rejectionReason?: string
  ): Promise<Withdrawal> {
    const response = await apiService.put<{ withdrawal: Withdrawal }>(
      `/admin/payments/${id}/status`,
      { status, rejectionReason }
    );
    return (response.data as any).withdrawal;
  },

  async downloadPayments(params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<string> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const response = await apiService.get<string>(`/admin/payments/download?${queryParams.toString()}`);
    return response.data as string;
  },

  async getAllUsers(params?: {
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    users: AdminUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await apiService.get<{ users: any[]; pagination: any }>(`/admin/users?${queryParams.toString()}`);

    // Transform _id to id
    const users = ((response.data as any).users || []).map((u: any) => ({
      ...u,
      id: u._id || u.id,
    }));

    return {
      users,
      pagination: (response.data as any).pagination,
    };
  },

  async getUserDetails(id: string): Promise<{
    user: AdminUser;
    withdrawals: Withdrawal[];
    transactions: any[];
  }> {
    const response = await apiService.get<{ user: AdminUser; withdrawals: Withdrawal[]; transactions: any[] }>(`/admin/users/${id}`);
    return response.data as any;
  },

  async blockUser(id: string, isActive: boolean): Promise<AdminUser> {
    const response = await apiService.put<{ user: any }>(
      `/admin/users/${id}/block`,
      { isActive }
    );
    const user = (response.data as any).user;
    return {
      ...user,
      id: user._id || user.id,
    };
  },

  async deleteUser(id: string): Promise<void> {
    await apiService.delete(`/admin/users/${id}`);
  },

  // Coin Management
  async getCoinConfigs(): Promise<CoinConfig[]> {
    const response = await apiService.get<CoinConfig[]>('/admin/coins');
    return ((response.data as any) || []).map((config: any) => ({
      ...config,
      id: config._id || config.id,
    }));
  },

  async updateCoinConfig(key: string, value: number): Promise<CoinConfig> {
    const response = await apiService.put<CoinConfig>(`/admin/coins/${key}`, { value });
    const data = response.data as any;
    return {
      ...data,
      id: data._id || data.id,
    };
  },

  async updateCoinConfigs(configs: Array<{ key: string; value: number }>): Promise<CoinConfig[]> {
    const response = await apiService.put<CoinConfig[]>('/admin/coins', { configs });
    return ((response.data as any) || []).map((config: any) => ({
      ...config,
      id: config._id || config.id,
    }));
  },

  // Task Submissions
  async getTaskSubmissions(status?: 'pending' | 'approved' | 'rejected', taskType?: string): Promise<TaskSubmission[]> {
    const params: any = {};
    if (status) params.status = status;
    if (taskType) params.taskType = taskType;

    const response = await apiService.get<TaskSubmission[]>('/admin/task-submissions', params);
    return ((response.data as any) || []).map((sub: any) => ({
      ...sub,
      id: sub._id || sub.id,
      task: {
        ...sub.task,
        id: sub.task?._id || sub.task?.id,
      },
      user: {
        ...sub.user,
        id: sub.user?._id || sub.user?.id,
      },
    }));
  },

  async getTaskSubmissionById(submissionId: string): Promise<TaskSubmission> {
    const response = await apiService.get<TaskSubmission>(`/admin/task-submissions/${submissionId}`);
    const data = response.data as any;
    return {
      ...data,
      id: data._id || data.id,
      task: {
        ...data.task,
        id: data.task?._id || data.task?.id,
      },
      user: {
        ...data.user,
        id: data.user?._id || data.user?.id,
      },
    };
  },

  async approveTaskSubmission(submissionId: string): Promise<{ message: string; coins: number }> {
    const response = await apiService.put<{ message: string; coins: number }>(`/admin/task-submissions/${submissionId}/approve`);
    return response.data as any;
  },

  async rejectTaskSubmission(submissionId: string, rejectionReason?: string): Promise<{ message: string }> {
    const response = await apiService.put<{ message: string }>(`/admin/task-submissions/${submissionId}/reject`, {
      rejectionReason,
    });
    return response.data as any;
  },

  // Creator Management
  async getCreatorRequests(status?: string): Promise<any[]> {
    const params = status ? { status } : {};
    const response = await apiService.get<any[]>('/admin/creator-requests', params);
    return ((response.data as any) || []).map((creator: any) => ({
      ...creator,
      id: creator._id || creator.id,
    }));
  },

  async approveCreator(creatorId: string): Promise<{ message: string }> {
    const response = await apiService.put<{ message: string }>(`/admin/creator-requests/${creatorId}/approve`);
    return response.data as any;
  },

  async rejectCreator(creatorId: string, rejectionReason?: string): Promise<{ message: string }> {
    const response = await apiService.put<{ message: string }>(`/admin/creator-requests/${creatorId}/reject`, {
      rejectionReason,
    });
    return response.data as any;
  },

  async getCreatorCoinRequests(status?: string): Promise<any[]> {
    const params = status ? { status } : {};
    const response = await apiService.get<any[]>('/admin/creator-coin-requests', params);
    return ((response.data as any) || []).map((request: any) => ({
      ...request,
      id: request._id || request.id,
      creator: request.creator
        ? {
          ...request.creator,
          id: request.creator._id || request.creator.id,
        }
        : null,
    }));
  },

  async approveCreatorCoinRequest(requestId: string): Promise<{ message: string; creatorWallet: number; creator: { id: string; name: string; username: string } }> {
    const response = await apiService.put<{ message: string; creatorWallet: number; creator: { id: string; name: string; username: string } }>(`/admin/creator-coin-requests/${requestId}/approve`);
    return response.data as any;
  },

  async rejectCreatorCoinRequest(requestId: string, rejectionReason: string): Promise<{ message: string }> {
    const response = await apiService.put<{ message: string }>(`/admin/creator-coin-requests/${requestId}/reject`, {
      rejectionReason,
    });
    return response.data as any;
  },

  // Withdrawal Settings
  async getWithdrawalSettings(): Promise<{
    minimumWithdrawalAmount: number;
    withdrawalAmounts: number[];
    updatedAt?: string;
    updatedBy?: string;
  }> {
    const response = await apiService.get<{
      minimumWithdrawalAmount: number;
      withdrawalAmounts: number[];
      updatedAt?: string;
      updatedBy?: string;
    }>('/admin/withdrawal-settings');
    return response.data as any;
  },

  async updateWithdrawalSettings(data: {
    minimumWithdrawalAmount?: number;
    withdrawalAmounts?: number[];
  }): Promise<{
    minimumWithdrawalAmount: number;
    withdrawalAmounts: number[];
    updatedAt?: string;
    updatedBy?: string;
  }> {
    const response = await apiService.put<{
      minimumWithdrawalAmount: number;
      withdrawalAmounts: number[];
      updatedAt?: string;
      updatedBy?: string;
    }>('/admin/withdrawal-settings', data);
    return response.data as any;
  },
};

export interface CoinConfig {
  id: string;
  key: string;
  value: number;
  label: string;
  description: string;
  updatedBy?: string;
  updatedAt: string;
  createdAt: string;
}

export interface TaskSubmission {
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
  reviewedBy?: {
    id: string;
    name: string;
    username: string;
  } | null;
  reviewedAt?: string | null;
  submittedAt: string;
}

