import { apiService } from './api';
import { Post } from '@types';
import { API_BASE_URL } from '@constants';

// Helper to get full image URL
const getImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  // Remove /api from base URL and add image path
  // API_BASE_URL is like "http://192.168.1.5:3000/api"
  // We need "http://192.168.1.5:3000/uploads/filename"
  const baseUrl = API_BASE_URL.replace('/api', '');
  // Ensure imageUrl starts with /
  const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return `${baseUrl}${path}`;
};

export const postService = {
  async getFeed(page: number = 1, limit: number = 10): Promise<{ posts: Post[]; hasMore: boolean }> {
    const response = await apiService.get<{ data: { posts: any[]; hasMore: boolean } }>('/posts/feed', {
      page,
      limit,
    });
    // apiService extracts data.data if success is true
    const feedData = response.data as any;
    const posts = (feedData.posts || []).map((post: any) => ({
      ...post,
      id: post._id || post.id,
      imageUrl: getImageUrl(post.imageUrl),
    }));
    return { posts, hasMore: feedData.hasMore || false };
  },

  async uploadPost(imageUri: string, caption: string): Promise<Post> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);
    formData.append('caption', caption);

    const response = await apiService.post<{ data: Post }>('/posts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const post = response.data;
    return {
      ...post,
      id: (post as any)._id || post.id,
      imageUrl: getImageUrl(post.imageUrl),
    };
  },

  async likePost(postId: string): Promise<void> {
    await apiService.post(`/posts/${postId}/like`);
  },

  async unlikePost(postId: string): Promise<void> {
    await apiService.post(`/posts/${postId}/unlike`);
  },

  async getPostById(postId: string): Promise<Post> {
    const response = await apiService.get<{ data: Post }>(`/posts/${postId}`);
    const post = response.data;
    return {
      ...post,
      id: (post as any)._id || post.id,
      imageUrl: getImageUrl(post.imageUrl),
    };
  },

  async addComment(postId: string, text: string): Promise<{ id: string; user: any; text: string; createdAt: string }> {
    const response = await apiService.post<{ data: { id: string; user: any; text: string; createdAt: string } }>(
      `/posts/${postId}/comments`,
      { text }
    );
    return {
      ...response.data,
      id: (response.data as any)._id || response.data.id,
    };
  },

  async getComments(postId: string): Promise<Array<{ id: string; user: any; text: string; createdAt: string }>> {
    const response = await apiService.get<{ data: Array<{ id: string; user: any; text: string; createdAt: string }> }>>(
      `/posts/${postId}/comments`
    );
    return (response.data || []).map((comment: any) => ({
      ...comment,
      id: comment._id || comment.id,
    }));
  },
};

