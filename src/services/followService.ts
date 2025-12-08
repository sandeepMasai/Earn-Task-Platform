import { apiService } from './api';

export interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export const followService = {
  async followUser(userId: string): Promise<FollowStats> {
    const response = await apiService.post<{ data: FollowStats }>(`/follow/${userId}`);
    return response.data;
  },

  async unfollowUser(userId: string): Promise<FollowStats> {
    const response = await apiService.delete<{ data: FollowStats }>(`/follow/${userId}`);
    return response.data;
  },

  async getFollowStats(userId: string): Promise<FollowStats> {
    const response = await apiService.get<{ data: FollowStats }>(`/follow/${userId}`);
    return response.data;
  },
};

