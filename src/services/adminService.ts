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
  recentUsers: User[];
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

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  coins: number;
  totalEarned: number;
  totalWithdrawn: number;
  isActive: boolean;
  createdAt: string;
}

export const adminService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiService.get<{ data: any }>('/admin/dashboard');
    const data = response.data;
    
    // Transform _id to id for withdrawals and users
    const recentWithdrawals = (data.recentWithdrawals || []).map((w: any) => ({
      ...w,
      id: w._id || w.id,
      user: {
        ...w.user,
        id: w.user?._id || w.user?.id,
      },
    }));
    
    const recentUsers = (data.recentUsers || []).map((u: any) => ({
      ...u,
      id: u._id || u.id,
    }));
    
    return {
      ...data,
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

    const response = await apiService.get<{
      data: { withdrawals: any[]; pagination: any };
    }>(`/admin/payments?${queryParams.toString()}`);
    
    // Transform _id to id
    const withdrawals = response.data.withdrawals.map((w: any) => ({
      ...w,
      id: w._id || w.id,
      user: {
        ...w.user,
        id: w.user?._id || w.user?.id,
      },
    }));
    
    return {
      withdrawals,
      pagination: response.data.pagination,
    };
  },

  async updatePaymentStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected' | 'completed',
    rejectionReason?: string
  ): Promise<Withdrawal> {
    const response = await apiService.put<{ data: { withdrawal: Withdrawal } }>(
      `/admin/payments/${id}/status`,
      { status, rejectionReason }
    );
    return response.data.withdrawal;
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

    const response = await apiService.get(`/admin/payments/download?${queryParams.toString()}`, {
      responseType: 'text',
    });
    return response.data;
  },

  async getAllUsers(params?: {
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    users: User[];
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

    const response = await apiService.get<{
      data: { users: any[]; pagination: any };
    }>(`/admin/users?${queryParams.toString()}`);
    
    // Transform _id to id
    const users = response.data.users.map((u: any) => ({
      ...u,
      id: u._id || u.id,
    }));
    
    return {
      users,
      pagination: response.data.pagination,
    };
  },

  async getUserDetails(id: string): Promise<{
    user: User;
    withdrawals: Withdrawal[];
    transactions: any[];
  }> {
    const response = await apiService.get<{
      data: { user: User; withdrawals: Withdrawal[]; transactions: any[] };
    }>(`/admin/users/${id}`);
    return response.data;
  },

  async blockUser(id: string, isActive: boolean): Promise<User> {
    const response = await apiService.put<{ data: { user: any } }>(
      `/admin/users/${id}/block`,
      { isActive }
    );
    return {
      ...response.data.user,
      id: response.data.user._id || response.data.user.id,
    };
  },

  async deleteUser(id: string): Promise<void> {
    await apiService.delete(`/admin/users/${id}`);
  },
};

