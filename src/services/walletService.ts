import { apiService } from './api';
import { Transaction, WithdrawalRequest } from '@types';

export const walletService = {
  async getBalance(): Promise<number> {
    const response = await apiService.get<{ balance: number }>('/wallet/balance');
    return (response.data as { balance: number }).balance;
  },

  async getTransactions(): Promise<Transaction[]> {
    const response = await apiService.get<{ data: Transaction[] }>('/wallet/transactions');
    // Transform _id to id if needed
    return (response.data as any).map((t: any) => ({
      ...t,
      id: t._id || t.id,
    })) as Transaction[];
  },

  async requestWithdrawal(
    amount: number,
    paymentMethod: string,
    accountDetails: string
  ): Promise<WithdrawalRequest> {
    const response = await apiService.post<WithdrawalRequest>('/wallet/withdraw', {
      amount,
      paymentMethod,
      accountDetails,
    });
    return response.data as WithdrawalRequest;
  },

  async getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    const response = await apiService.get<{ data: WithdrawalRequest[] }>('/wallet/withdrawals');
    // Transform _id to id if needed
    return (response.data as any).map((w: any) => ({
      ...w,
      id: w._id || w.id,
    })) as WithdrawalRequest[];
  },

  async getWithdrawalSettings(): Promise<{
    minimumWithdrawalAmount: number;
    withdrawalAmounts: number[];
  }> {
    const response = await apiService.get<{
      minimumWithdrawalAmount: number;
      withdrawalAmounts: number[];
    }>('/wallet/withdrawal-settings');
    return response.data as any;
  },
};

