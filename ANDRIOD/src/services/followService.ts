import { apiService } from './api';

export interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export const followService = {
  async followUser(userId: string): Promise<FollowStats> {
    const response = await apiService.post<FollowStats>(`/follow/${userId}`);
    return response.data as any;
  },

  async unfollowUser(userId: string): Promise<FollowStats> {
    const response = await apiService.delete<FollowStats>(`/follow/${userId}`);
    return response.data as any;
  },

  async getFollowStats(userId: string): Promise<FollowStats> {
    const response = await apiService.get<FollowStats>(`/follow/${userId}`);
    return response.data as any;
  },
};

