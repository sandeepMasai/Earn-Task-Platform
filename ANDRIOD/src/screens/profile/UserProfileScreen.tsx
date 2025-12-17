import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { followUser, unfollowUser, deletePost } from '@store/slices/feedSlice';
import { followService } from '@services/followService';
import { postService } from '@services/postService';
import { userService } from '@services/userService';
import { formatCoins } from '@utils/validation';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import PostCard from '@components/feed/PostCard';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Post } from '@types';
import { ROUTES, API_BASE_URL } from '../../constants/index';

const UserProfileScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const { userId } = route.params;

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);

      // Get user data
      const userData = await userService.getUserById(userId);
      setUser(userData);

      // Get follow stats
      const stats = await followService.getFollowStats(userId);
      setIsFollowing(stats.isFollowing);

      // Get user posts
      const feedData = await postService.getFeed(1, 20);
      const userPosts = feedData.posts.filter((post) => post.userId === userId);
      setPosts(userPosts);

      // Check if it's own profile
      setIsOwnProfile(currentUser?.id?.toString() === userId?.toString());
    } catch (error: any) {
      console.error('Error loading user profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load user profile',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
    }, [userId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserProfile();
    setRefreshing(false);
  };

  // Helper to get full avatar URL
  const getAvatarUrl = (avatar: string | null | undefined): string | null => {
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    if (avatar.startsWith('/uploads/')) {
      const baseUrl = API_BASE_URL.replace('/api', '');
      return `${baseUrl}${avatar}`;
    }
    return avatar;
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await dispatch(unfollowUser(userId)).unwrap();
        setIsFollowing(false);
        Toast.show({
          type: 'success',
          text1: 'Unfollowed',
          text2: 'You have unfollowed this user',
        });
      } else {
        await dispatch(followUser(userId)).unwrap();
        setIsFollowing(true);
        Toast.show({
          type: 'success',
          text1: 'Following',
          text2: 'You are now following this user',
        });
      }
      // Reload stats
      const stats = await followService.getFollowStats(userId);
      if (user) {
        setUser({ ...user, followersCount: stats.followersCount });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to follow/unfollow user',
      });
    }
  };

  const handleLike = (postId: string, isLiked: boolean) => {
    // Handle like - to be implemented
    console.log('Like post:', postId, isLiked);
  };

  const handleComment = (postId: string) => {
    navigation.navigate('Comments', { postId });
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
      // Reload posts
      loadUserProfile();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to delete post',
      });
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{user.name || 'Profile'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image
                source={{ uri: getAvatarUrl(user.avatar) || '' }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={48} color="#8E8E93" />
              </View>
            )}
          </View>
          <Text style={styles.name}>{user.name || 'User'}</Text>
          <Text style={styles.username}>@{user.username || 'username'}</Text>

          {/* Follow Button */}
          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.followButtonText, isFollowing && styles.followingButtonText]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.followersCount || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.followingCount || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Posts Grid */}
        <View style={styles.postsSection}>
          <Text style={styles.postsTitle}>Posts</Text>
          {posts.length > 0 ? (
            <View style={styles.postsList}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={() => handleLike(post.id, post.isLiked)}
                  onComment={() => handleComment(post.id)}
                  onFollow={handleFollow}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  showMenu={isOwnProfile}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyPosts}>
              <Ionicons name="grid-outline" size={64} color="#8E8E93" />
              <Text style={styles.emptyPostsText}>No posts yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 20,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F2F2F7',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  followButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginBottom: 24,
    minWidth: 120,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#E5E5EA',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#000000',
  },
  statsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingHorizontal: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  postsSection: {
    paddingTop: 24,
  },
  postsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 20,
  },
  postsList: {
    flex: 1,
  },
  emptyPosts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyPostsText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 40,
  },
});

export default UserProfileScreen;

