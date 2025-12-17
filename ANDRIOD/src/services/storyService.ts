import { apiService } from './api';
import { StoryGroup, Story } from '@types';
import { API_BASE_URL } from '@constants';

// Helper to get full media URL
const getMediaUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = API_BASE_URL.replace('/api', '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${path}`;
};

export const storyService = {
  async getStories(): Promise<StoryGroup[]> {
    const response = await apiService.get<StoryGroup[]>('/stories');
    // Transform media URLs
    return ((response.data as any) || []).map((group: StoryGroup) => ({
      ...group,
      stories: group.stories.map((story: Story) => ({
        ...story,
        mediaUrl: getMediaUrl(story.mediaUrl),
        thumbnailUrl: story.thumbnailUrl ? getMediaUrl(story.thumbnailUrl) : undefined,
      })),
    }));
  },

  async uploadStory(
    mediaUri: string,
    type: 'image' | 'video',
    videoDuration?: number
  ): Promise<Story> {
    const formData = new FormData();
    formData.append('media', {
      uri: mediaUri,
      type: type === 'image' ? 'image/jpeg' : 'video/mp4',
      name: type === 'image' ? 'photo.jpg' : 'video.mp4',
    } as any);
    formData.append('type', type);
    if (videoDuration) {
      formData.append('videoDuration', videoDuration.toString());
    }

    const response = await apiService.post<Story>('/stories', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const story = response.data as any;
    return {
      ...story,
      id: story._id || story.id,
      mediaUrl: getMediaUrl(story.mediaUrl),
      thumbnailUrl: story.thumbnailUrl ? getMediaUrl(story.thumbnailUrl) : undefined,
    };
  },

  async viewStory(storyId: string): Promise<void> {
    await apiService.post(`/stories/${storyId}/view`);
  },
};

