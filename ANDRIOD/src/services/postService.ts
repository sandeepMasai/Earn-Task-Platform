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
  async getMyPosts(page: number = 1, limit: number = 10): Promise<{ posts: Post[]; hasMore: boolean }> {
    const response = await apiService.get<{ data: { posts: any[]; hasMore: boolean } }>('/posts/me', {
      page,
      limit,
    });
    const data = response.data as any;
    const posts = (data.posts || []).map((post: any) => ({
      ...post,
      id: post._id || post.id,
      userId: post.userId || post.user?._id || post.userId,
      userAvatar: post.userAvatar ? getImageUrl(post.userAvatar) : undefined,
      imageUrl: post.imageUrl ? getImageUrl(post.imageUrl) : undefined,
      videoUrl: post.videoUrl ? getImageUrl(post.videoUrl) : undefined,
      documentUrl: post.documentUrl ? getImageUrl(post.documentUrl) : undefined,
      thumbnailUrl: post.thumbnailUrl ? getImageUrl(post.thumbnailUrl) : undefined,
      isFollowing: post.isFollowing !== undefined ? post.isFollowing : true,
      followersCount: post.followersCount !== undefined ? post.followersCount : 0,
    }));
    return { posts, hasMore: data.hasMore || false };
  },
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
      userId: post.userId || post.user?._id || post.userId,
      userAvatar: post.userAvatar ? getImageUrl(post.userAvatar) : undefined,
      imageUrl: post.imageUrl ? getImageUrl(post.imageUrl) : undefined,
      videoUrl: post.videoUrl ? getImageUrl(post.videoUrl) : undefined,
      documentUrl: post.documentUrl ? getImageUrl(post.documentUrl) : undefined,
      thumbnailUrl: post.thumbnailUrl ? getImageUrl(post.thumbnailUrl) : undefined,
      isFollowing: post.isFollowing !== undefined ? post.isFollowing : false,
      followersCount: post.followersCount !== undefined ? post.followersCount : 0,
    }));
    return { posts, hasMore: feedData.hasMore || false };
  },

  async uploadPost(
    fileUri: string,
    caption: string,
    type: 'image' | 'video' | 'document' = 'image',
    videoDuration?: number
  ): Promise<Post> {
    const formData = new FormData();
    
    // Determine file type and name
    let mimeType = 'image/jpeg';
    let fileName = 'photo.jpg';
    
    if (type === 'video') {
      mimeType = 'video/mp4';
      fileName = 'video.mp4';
    } else if (type === 'document') {
      // Try to detect document type from URI
      if (fileUri.endsWith('.pdf')) {
        mimeType = 'application/pdf';
        fileName = 'document.pdf';
      } else if (fileUri.endsWith('.txt')) {
        mimeType = 'text/plain';
        fileName = 'document.txt';
      } else {
        mimeType = 'application/pdf';
        fileName = 'document.pdf';
      }
    }

    formData.append('image', {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any);
    formData.append('caption', caption);
    formData.append('type', type);
    if (videoDuration) {
      formData.append('videoDuration', videoDuration.toString());
    }

    const response = await apiService.post<Post>('/posts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const post = response.data as any;
    return {
      ...post,
      id: post._id || post.id,
      imageUrl: post.imageUrl ? getImageUrl(post.imageUrl) : undefined,
      videoUrl: post.videoUrl ? getImageUrl(post.videoUrl) : undefined,
      documentUrl: post.documentUrl ? getImageUrl(post.documentUrl) : undefined,
      thumbnailUrl: post.thumbnailUrl ? getImageUrl(post.thumbnailUrl) : undefined,
    };
  },

  async likePost(postId: string): Promise<void> {
    await apiService.post(`/posts/${postId}/like`);
  },

  async unlikePost(postId: string): Promise<void> {
    await apiService.post(`/posts/${postId}/unlike`);
  },

  async getPostById(postId: string): Promise<Post> {
    const response = await apiService.get<Post>(`/posts/${postId}`);
    const post = response.data as any;
    return {
      ...post,
      id: post._id || post.id,
      imageUrl: post.imageUrl ? getImageUrl(post.imageUrl) : undefined,
      videoUrl: post.videoUrl ? getImageUrl(post.videoUrl) : undefined,
      documentUrl: post.documentUrl ? getImageUrl(post.documentUrl) : undefined,
      thumbnailUrl: post.thumbnailUrl ? getImageUrl(post.thumbnailUrl) : undefined,
    };
  },

  async addComment(postId: string, text: string): Promise<{ id: string; user: any; text: string; createdAt: string }> {
    const response = await apiService.post<{ id: string; user: any; text: string; createdAt: string }>(
      `/posts/${postId}/comments`,
      { text }
    );
    const data = response.data as any;
    return {
      ...data,
      id: data._id || data.id,
    };
  },

  async getComments(postId: string): Promise<Array<{ id: string; user: any; text: string; createdAt: string }>> {
    const response = await apiService.get<Array<{ id: string; user: any; text: string; createdAt: string }>>(
      `/posts/${postId}/comments`
    );
    return (response.data || []).map((comment: any) => ({
      ...comment,
      id: comment._id || comment.id,
    }));
  },

  async updatePost(postId: string, caption: string): Promise<Post> {
    const response = await apiService.put<Post>(`/posts/${postId}`, { caption });
    const post = response.data as any;
    return {
      ...post,
      id: post._id || post.id,
      imageUrl: post.imageUrl ? getImageUrl(post.imageUrl) : undefined,
      videoUrl: post.videoUrl ? getImageUrl(post.videoUrl) : undefined,
      documentUrl: post.documentUrl ? getImageUrl(post.documentUrl) : undefined,
      thumbnailUrl: post.thumbnailUrl ? getImageUrl(post.thumbnailUrl) : undefined,
    };
  },

  async deletePost(postId: string): Promise<void> {
    await apiService.delete(`/posts/${postId}`);
  },
};

