import { apiService } from './api';

export interface ReferralStats {
  referralCode: string;
  referralCount: number;
  totalReferralEarnings: number;
  referrals: Array<{
    id: string;
    username: string;
    email: string;
    createdAt: string;
  }>;
}

export const referralService = {
  async getReferralStats(): Promise<ReferralStats> {
    const response = await apiService.get<ReferralStats>('/referrals/stats');
    return response.data as any;
  },

  async checkReferralCode(code: string): Promise<{ valid: boolean; referrerName?: string }> {
    const response = await apiService.get<{ valid: boolean; referrerName?: string }>(
      `/referrals/check/${code}`
    );
    return response.data as any;
  },
};

