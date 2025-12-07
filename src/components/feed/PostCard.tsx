import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Post } from '@types';
import { formatDate } from '@utils/validation';
import { Ionicons } from '@expo/vector-icons';

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike, onComment }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {post.userAvatar ? (
            <Image source={{ uri: post.userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#8E8E93" />
            </View>
          )}
          <View>
            <Text style={styles.userName}>{post.userName}</Text>
            <Text style={styles.time}>{formatDate(post.createdAt)}</Text>
          </View>
        </View>
      </View>
      {post.imageUrl ? (
        <Image 
          source={{ uri: post.imageUrl }} 
          style={styles.image}
          resizeMode="cover"
          onError={(e) => {
            console.error('Image load error:', e.nativeEvent.error);
          }}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={48} color="#8E8E93" />
          <Text style={styles.imagePlaceholderText}>Image not available</Text>
        </View>
      )}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onLike}
          activeOpacity={0.7}
        >
          <Ionicons
            name={post.isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={post.isLiked ? '#FF3B30' : '#000000'}
          />
          <Text style={styles.actionText}>{post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onComment}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#000000" />
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>
      </View>
      {post.caption && (
        <View style={styles.caption}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUser}>{post.userName}</Text> {post.caption}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  time: {
    fontSize: 12,
    color: '#8E8E93',
  },
  image: {
    width: '100%',
    height: 400,
    backgroundColor: '#F2F2F7',
  },
  imagePlaceholder: {
    width: '100%',
    height: 400,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 6,
  },
  caption: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  captionText: {
    fontSize: 14,
    color: '#000000',
  },
  captionUser: {
    fontWeight: '600',
  },
});

export default PostCard;

