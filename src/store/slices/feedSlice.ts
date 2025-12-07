import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { FeedState, Post } from '@types';
import { postService } from '@services/postService';

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
  async ({ imageUri, caption }: { imageUri: string; caption: string }, { rejectWithValue }) => {
    try {
      const post = await postService.uploadPost(imageUri, caption);
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
        if (action.payload.posts.length === 0) {
          state.hasMore = false;
        } else {
          // If posts array is empty or first post is different, replace (refresh)
          // Otherwise append (load more)
          if (state.posts.length === 0 || state.posts[0]?.id !== action.payload.posts[0]?.id) {
            state.posts = action.payload.posts;
          } else {
            state.posts = [...state.posts, ...action.payload.posts];
          }
          state.hasMore = action.payload.hasMore;
        }
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
  },
});

export const { clearFeed, addPost } = feedSlice.actions;
export default feedSlice.reducer;

