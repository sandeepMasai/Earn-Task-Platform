import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchFeed, likePost, unlikePost, clearFeed, followUser, unfollowUser, updatePost, deletePost } from '@store/slices/feedSlice';
import { ROUTES } from '../../constants/index';
import PostCard from '@components/feed/PostCard';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const FeedScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { posts, isLoading, hasMore } = useAppSelector((state) => state.feed);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [currentPlayingVideo, setCurrentPlayingVideo] = useState<string | null>(null);

  const loadFeed = useCallback(() => {
    setPage(1);
    dispatch(clearFeed());
    dispatch(fetchFeed({ page: 1, limit: 10 }));
  }, [dispatch]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Reset page when feed is cleared
  useEffect(() => {
    if (posts.length === 0 && !isLoading && page > 1) {
      setPage(1);
    }
  }, [posts.length, isLoading, page]);

  // Refresh when screen comes into focus (e.g., after uploading a post)
  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    dispatch(clearFeed());
    setPage(1);
    await dispatch(fetchFeed({ page: 1, limit: 10 }));
    setRefreshing(false);
  };

  const handleLoadMore = useCallback(() => {
    // Prevent multiple simultaneous requests
    // Also check if user is authenticated (hasMore will be false on 401)
    if (hasMore && !isLoading && !refreshing) {
      const nextPage = page + 1;
      setPage(nextPage);
      dispatch(fetchFeed({ page: nextPage, limit: 10 })).catch((error: any) => {
        // If 401 error, stop pagination
        if (error?.message?.includes('401') || error?.message?.includes('Not authorized')) {
          console.log('Authentication error - stopping feed pagination');
        }
      });
    }
  }, [hasMore, isLoading, refreshing, page, dispatch]);

  const handleLike = (postId: string, isLiked: boolean) => {
    if (isLiked) {
      dispatch(unlikePost(postId));
    } else {
      dispatch(likePost(postId));
    }
  };

  const handleComment = (postId: string) => {
    navigation.navigate(ROUTES.COMMENTS, { postId });
  };

  const handleFollow = async (userId: string, isFollowing: boolean) => {
    try {
      if (isFollowing) {
        await dispatch(unfollowUser(userId)).unwrap();
        Toast.show({
          type: 'success',
          text1: 'Unfollowed',
          text2: 'You have unfollowed this user',
        });
      } else {
        await dispatch(followUser(userId)).unwrap();
        Toast.show({
          type: 'success',
          text1: 'Following',
          text2: 'You are now following this user',
        });
      }
      // Update posts in place - Redux slice will update the follow status automatically
    } catch (error: any) {
      console.error('Follow/unfollow error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to follow/unfollow user. Please try again.',
      });
    }
  };

  const handleEdit = (postId: string, currentCaption: string) => {
    navigation.navigate(ROUTES.EDIT_POST, { postId, currentCaption });
  };

  const handleDelete = async (postId: string) => {
    try {
      await dispatch(deletePost(postId)).unwrap();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Post deleted successfully',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to delete post',
      });
    }
  };

  if (isLoading && posts.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => navigation.navigate(ROUTES.UPLOAD_POST)}
        >
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isVisible = visibleItems.has(item.id);
          const shouldPlay = currentPlayingVideo === item.id && item.type === 'video';
          
          return (
            <PostCard
              post={item}
              onLike={() => handleLike(item.id, item.isLiked)}
              onComment={() => handleComment(item.id)}
              onFollow={handleFollow}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isVisible={isVisible}
              shouldPlay={shouldPlay}
            />
          );
        }}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50, // Item is considered visible when 50% is shown
          minimumViewTime: 300, // Minimum time item must be visible (ms)
        }}
        onViewableItemsChanged={({ viewableItems }) => {
          const newVisibleItems = new Set<string>();
          let firstVideoId: string | null = null;
          
          // Find the first visible video post
          for (const item of viewableItems) {
            if (item.isViewable && item.item) {
              newVisibleItems.add(item.item.id);
              
              // If this is a video and we don't have a playing video yet, set it
              if (!firstVideoId && item.item.type === 'video') {
                firstVideoId = item.item.id;
              }
            }
          }
          
          setVisibleItems(newVisibleItems);
          
          // Set the first visible video as playing, or clear if none
          if (firstVideoId) {
            setCurrentPlayingVideo(firstVideoId);
          } else {
            setCurrentPlayingVideo(null);
          }
        }}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color="#8E8E93" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share something!</Text>
          </View>
        }
        ListFooterComponent={
          isLoading && posts.length > 0 ? (
            <View style={styles.footerLoader}>
              <LoadingSpinner size="small" />
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  uploadButton: {
    padding: 4,
  },
  listContent: {
    padding: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  footerLoader: {
    paddingVertical: 20,
  },
});

export default FeedScreen;

