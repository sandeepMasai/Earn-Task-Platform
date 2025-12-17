import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { deletePost } from '@store/slices/feedSlice';
import { postService } from '@services/postService';
import { Post } from '@types';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@utils/validation';

const MyPostsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = async (pageToLoad = 1, replace = false) => {
    if (!user) return;
    try {
      if (pageToLoad === 1) {
        setIsLoading(true);
      }
      const { posts: fetched, hasMore: more } = await postService.getMyPosts(pageToLoad, 10);
      setPosts((prev) => (replace ? fetched : [...prev, ...fetched.filter((p) => !prev.find((x) => x.id === p.id))]));
      setHasMore(more);
      setPage(pageToLoad);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPosts(1, true);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts(1, true);
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      loadPosts(page + 1);
    }
  };

  const handleDelete = (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dispatch(deletePost(postId)).unwrap();
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to delete post');
          }
        },
      },
    ]);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.caption} numberOfLines={2}>
          {item.caption || 'Untitled'}
        </Text>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>

      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.media} resizeMode="cover" />
      ) : item.videoUrl ? (
        <View style={[styles.media, styles.videoPlaceholder]}>
          <Ionicons name="videocam-outline" size={32} color="#8E8E93" />
          <Text style={styles.placeholderText}>Video</Text>
        </View>
      ) : (
        <View style={[styles.media, styles.docPlaceholder]}>
          <Ionicons name="document-text-outline" size={28} color="#8E8E93" />
          <Text style={styles.placeholderText}>Document</Text>
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('EditPost', { postId: item.id, currentCaption: item.caption })}
        >
          <Ionicons name="create-outline" size={20} color="#007AFF" />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          <Text style={[styles.actionText, { color: '#FF3B30' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading && posts.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            !isLoading ? <Text style={styles.emptyText}>You have not posted anything yet.</Text> : null
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            isLoading && posts.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  caption: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginRight: 8,
  },
  date: {
    fontSize: 12,
    color: '#8E8E93',
  },
  media: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  docPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  placeholderText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 12,
  },
});

export default MyPostsScreen;

