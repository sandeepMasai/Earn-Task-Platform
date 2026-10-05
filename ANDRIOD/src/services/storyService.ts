import { apiService } from './api';
import { mediaService } from './mediaService';
import { StoryGroup, Story } from '@types';
import { resolveMediaUrl } from '@utils/mediaUrl';

export const storyService = {
  async getStories(): Promise<StoryGroup[]> {
    const response = await apiService.get<StoryGroup[]>('/stories');
    // Transform media URLs
    return ((response.data as any) || []).map((group: StoryGroup) => ({
      ...group,
      stories: group.stories.map((story: Story) => ({
        ...story,
        mediaUrl: resolveMediaUrl(story.mediaUrl),
        thumbnailUrl: story.thumbnailUrl ? resolveMediaUrl(story.thumbnailUrl) : undefined,
      })),
    }));
  },

  async uploadStory(
    mediaUri: string,
    type: 'image' | 'video',
    videoDuration?: number
  ): Promise<Story> {
    try {
      const category = type === 'video' ? 'videos' : 'images';
      const { mediaId } = await mediaService.uploadMedia({
        uri: mediaUri,
        category,
      });
      const response = await apiService.post<Story>('/stories', {
        mediaId,
        type,
      });
      const story = (response as any).data ?? response;
      return {
        ...story,
        id: story._id || story.id,
        mediaUrl: resolveMediaUrl(story.mediaUrl),
        thumbnailUrl: story.thumbnailUrl ? resolveMediaUrl(story.thumbnailUrl) : undefined,
      };
    } catch {
      // Fall back to multipart if direct upload fails
    }

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
      mediaUrl: resolveMediaUrl(story.mediaUrl),
      thumbnailUrl: story.thumbnailUrl ? resolveMediaUrl(story.thumbnailUrl) : undefined,
    };
  },

  async viewStory(storyId: string): Promise<void> {
    await apiService.post(`/stories/${storyId}/view`);
  },
};

