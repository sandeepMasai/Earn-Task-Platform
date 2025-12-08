import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { FeedState, Post } from '@types';
import { postService } from '@services/postService';
import { followService } from '@services/followService';

const initialState: FeedState = {
  posts: [],
  isLoading: false,
  error: null,
  hasMore: true,
};

export const fetchFeed = createAsyncThunk(
  'feed/fetchFeed',
  async ({ page = 1, limit = 10 }: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const result = await postService.getFeed(page, limit);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const uploadPost = createAsyncThunk(
  'feed/uploadPost',
  async (
    {
      fileUri,
      caption,
      type,
      videoDuration,
    }: {
      fileUri: string;
      caption: string;
      type?: 'image' | 'video' | 'document';
      videoDuration?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const post = await postService.uploadPost(fileUri, caption, type, videoDuration);
      return post;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const likePost = createAsyncThunk(
  'feed/likePost',
  async (postId: string, { rejectWithValue }) => {
    try {
      await postService.likePost(postId);
      return postId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const unlikePost = createAsyncThunk(
  'feed/unlikePost',
  async (postId: string, { rejectWithValue }) => {
    try {
      await postService.unlikePost(postId);
      return postId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const addComment = createAsyncThunk(
  'feed/addComment',
  async ({ postId, text }: { postId: string; text: string }, { rejectWithValue }) => {
    try {
      await postService.addComment(postId, text);
      return { postId };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updatePost = createAsyncThunk(
  'feed/updatePost',
  async ({ postId, caption }: { postId: string; caption: string }, { rejectWithValue }) => {
    try {
      const updatedPost = await postService.updatePost(postId, caption);
      return updatedPost;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deletePost = createAsyncThunk(
  'feed/deletePost',
  async (postId: string, { rejectWithValue }) => {
    try {
      await postService.deletePost(postId);
      return postId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const followUser = createAsyncThunk(
  'feed/followUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const stats = await followService.followUser(userId);
      return { userId, stats };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const unfollowUser = createAsyncThunk(
  'feed/unfollowUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const stats = await followService.unfollowUser(userId);
      return { userId, stats };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    clearFeed: (state) => {
      state.posts = [];
      state.hasMore = true;
    },
    addPost: (state, action: PayloadAction<Post>) => {
      state.posts.unshift(action.payload);
    },
  },
  extraReducers: (builder) => {
    // Fetch Feed
    builder
      .addCase(fetchFeed.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.isLoading = false;
        const { posts: newPosts, hasMore } = action.payload;
        
        if (newPosts.length === 0) {
          state.hasMore = false;
          return;
        }
        
        // If posts array is empty or first post is different, replace (refresh)
        // Otherwise append (load more) - but filter out duplicates
        if (state.posts.length === 0 || state.posts[0]?.id !== newPosts[0]?.id) {
          state.posts = newPosts;
        } else {
          // Filter out duplicates by ID before appending
          const existingIds = new Set(state.posts.map(p => p.id));
          const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
          if (uniqueNewPosts.length > 0) {
            state.posts = [...state.posts, ...uniqueNewPosts];
          }
        }
        
        // Set hasMore based on response
        state.hasMore = hasMore !== undefined ? hasMore : newPosts.length >= 10;
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Upload Post
    builder
      .addCase(uploadPost.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(uploadPost.fulfilled, (state, action) => {
        state.isLoading = false;
        state.posts.unshift(action.payload);
      })
      .addCase(uploadPost.rejected, (state) => {
        state.isLoading = false;
      });

    // Like Post
    builder
      .addCase(likePost.fulfilled, (state, action) => {
        const post = state.posts.find((p) => p.id === action.payload);
        if (post) {
          post.isLiked = true;
          post.likes += 1;
        }
      });

    // Unlike Post
    builder
      .addCase(unlikePost.fulfilled, (state, action) => {
        const post = state.posts.find((p) => p.id === action.payload);
        if (post) {
          post.isLiked = false;
          post.likes -= 1;
        }
      });

    // Add Comment
    builder
      .addCase(addComment.fulfilled, (state, action) => {
        const post = state.posts.find((p) => p.id === action.payload.postId);
        if (post) {
          post.comments += 1;
        }
      });

    // Follow User
    builder
      .addCase(followUser.pending, (state) => {
        // Optional: Set loading state if needed
      })
      .addCase(followUser.fulfilled, (state, action) => {
        const { userId, stats } = action.payload;
        state.posts.forEach((post) => {
          if (post.userId && userId && post.userId.toString() === userId.toString()) {
            post.isFollowing = true;
            post.followersCount = stats.followersCount;
          }
        });
      })
      .addCase(followUser.rejected, (state, action) => {
        // Error handling - could show toast here
        console.error('Follow error:', action.payload);
      });

    // Unfollow User
    builder
      .addCase(unfollowUser.pending, (state) => {
        // Optional: Set loading state if needed
      })
      .addCase(unfollowUser.fulfilled, (state, action) => {
        const { userId, stats } = action.payload;
        state.posts.forEach((post) => {
          if (post.userId && userId && post.userId.toString() === userId.toString()) {
            post.isFollowing = false;
            post.followersCount = stats.followersCount;
          }
        });
      })
      .addCase(unfollowUser.rejected, (state, action) => {
        // Error handling - could show toast here
        console.error('Unfollow error:', action.payload);
      });

    // Update Post
    builder
      .addCase(updatePost.fulfilled, (state, action) => {
        const updatedPost = action.payload;
        const index = state.posts.findIndex((p) => p.id === updatedPost.id);
        if (index !== -1) {
          state.posts[index] = { ...state.posts[index], ...updatedPost };
        }
      });

    // Delete Post
    builder
      .addCase(deletePost.fulfilled, (state, action) => {
        const postId = action.payload;
        state.posts = state.posts.filter((p) => p.id !== postId);
      });
  },
});

export const { clearFeed, addPost } = feedSlice.actions;
export default feedSlice.reducer;

