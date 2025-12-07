import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchFeed, likePost, unlikePost, clearFeed } from '@store/slices/feedSlice';
import { ROUTES } from '@constants';
import PostCard from '@components/feed/PostCard';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';

const FeedScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { posts, isLoading, hasMore } = useAppSelector((state) => state.feed);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(() => {
    setPage(1);
    dispatch(clearFeed());
    dispatch(fetchFeed({ page: 1, limit: 10 }));
  }, [dispatch]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

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

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      dispatch(fetchFeed({ page: nextPage, limit: 10 }));
    }
  };

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
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => handleLike(item.id, item.isLiked)}
            onComment={() => handleComment(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
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
    padding: 16,
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

