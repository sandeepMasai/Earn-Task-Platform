import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, Share, Platform, Alert, Modal } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { Post } from '@types';
import { formatDate } from '@utils/validation';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { useAppSelector } from '@store/hooks';
import { ROUTES } from '../../constants/index';

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onFollow?: (userId: string, isFollowing: boolean) => void;
  onEdit?: (postId: string, currentCaption: string) => void;
  onDelete?: (postId: string) => void;
  showMenu?: boolean; // Show three-dot menu (only in profile section)
  isVisible?: boolean; // Whether this post is currently visible in viewport
  shouldPlay?: boolean; // Whether video should be playing
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onLike,
  onComment,
  onFollow,
  onEdit,
  onDelete,
  showMenu = false,
  isVisible = true,
  shouldPlay = true,
}) => {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector((state) => state.auth);
  // Compare IDs as strings to handle both string and ObjectId formats
  // Also check if user exists and post has userId
  const isOwnPost = user?.id && post.userId && user.id.toString() === post.userId.toString();
  const [isMuted, setIsMuted] = useState(true); // Start muted (Instagram style)
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showPlayIcon, setShowPlayIcon] = useState(false); // Hide play icon initially

  const player = post.videoUrl
    ? useVideoPlayer(post.videoUrl, (player) => {
      player.loop = true;
      player.muted = true; // Start muted
      // Don't play immediately - let the visibility effect handle it
    })
    : null;

  // Control video play/pause based on visibility
  React.useEffect(() => {
    if (!player || !post.videoUrl) return;

    let playIconTimeout: NodeJS.Timeout | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    // Small delay to ensure player is ready
    const playTimeout = setTimeout(() => {
      if (isVisible && shouldPlay) {
        // Video is visible and should play
        const attemptPlay = () => {
          try {
            player.play();
            setIsPlaying(true);
            setShowPlayIcon(true);
            // Auto-hide play icon after 3 seconds
            playIconTimeout = setTimeout(() => {
              setShowPlayIcon(false);
            }, 3000);
          } catch (error) {
            console.log('Video play error:', error);
            // Retry after a short delay if player wasn't ready
            retryTimeout = setTimeout(() => {
              try {
                if (isVisible && shouldPlay && player) {
                  player.play();
                  setIsPlaying(true);
                  setShowPlayIcon(true);
                  playIconTimeout = setTimeout(() => {
                    setShowPlayIcon(false);
                  }, 3000);
                }
              } catch (retryError) {
                console.log('Video play retry error:', retryError);
              }
            }, 500);
          }
        };

        attemptPlay();
      } else {
        // Video is not visible or shouldn't play - pause it
        try {
          player.pause();
          setIsPlaying(false);
          setShowPlayIcon(false);
        } catch (error) {
          console.log('Video pause error:', error);
        }
      }
    }, 200);

    return () => {
      clearTimeout(playTimeout);
      if (playIconTimeout) clearTimeout(playIconTimeout);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [player, post.videoUrl, isVisible, shouldPlay]);

  // Update mute state when isMuted changes
  React.useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [isMuted, player]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVideoPress = (e?: any) => {
    e?.stopPropagation?.();
    if (!player) return;

    // Clear any existing timeout
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
      setControlsTimeout(null);
    }

    try {
      // Get current playing state directly from player
      const currentlyPlaying = player.playing ?? isPlaying;

      if (currentlyPlaying) {
        // Pause the video
        player.pause();
        setIsPlaying(false);
        setShowControls(true);
        setShowPlayIcon(true);

        // Auto-hide play icon after 3 seconds
        const timeout = setTimeout(() => {
          setShowPlayIcon(false);
        }, 3000);
        setControlsTimeout(timeout);
      } else {
        // Play the video
        player.play();
        setIsPlaying(true);
        setShowControls(true);
        setShowPlayIcon(true);

        // Hide controls and icon after 3 seconds if playing
        const timeout = setTimeout(() => {
          setShowControls(false);
          setShowPlayIcon(false);
        }, 3000);
        setControlsTimeout(timeout);
      }
    } catch (error) {
      console.log('Video player error:', error);
      // Fallback: use state-based toggle
      try {
        if (isPlaying) {
          player.pause();
          setIsPlaying(false);
          setShowControls(true);
          setShowPlayIcon(true);
          const timeout = setTimeout(() => {
            setShowPlayIcon(false);
          }, 3000);
          setControlsTimeout(timeout);
        } else {
          player.play();
          setIsPlaying(true);
          setShowControls(true);
          setShowPlayIcon(true);
          const timeout = setTimeout(() => {
            setShowControls(false);
            setShowPlayIcon(false);
          }, 3000);
          setControlsTimeout(timeout);
        }
      } catch (fallbackError) {
        console.log('Fallback error:', fallbackError);
      }
    }
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

  // Monitor player playing state - more reliable
  React.useEffect(() => {
    if (!player) return;

    let isMounted = true;

    const updateStatus = () => {
      if (!isMounted || !player) return;

      try {
        // Check if player is playing - use the playing property directly
        const playing = player.playing;
        if (playing !== undefined) {
          // Only update if state actually changed
          if (playing !== isPlaying) {
            setIsPlaying(playing);
            // If video stopped playing unexpectedly, show controls
            if (!playing && !showControls) {
              setShowControls(true);
              setShowPlayIcon(true);
              // Auto-hide after 3 seconds
              if (controlsTimeout) {
                clearTimeout(controlsTimeout);
              }
              const timeout = setTimeout(() => {
                if (isMounted) {
                  setShowPlayIcon(false);
                }
              }, 3000);
              setControlsTimeout(timeout);
            }
          }
        }
      } catch (error) {
        // Ignore errors if player is released
      }
    };

    // Update status more frequently for better responsiveness
    const interval = setInterval(updateStatus, 150);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [player]);

  const handleShare = async () => {
    try {
      const shareUrl = post.videoUrl || post.imageUrl || post.documentUrl || '';
      const message = `${post.userName}: ${post.caption || 'Check out this post!'}`;

      // If no URL available, just share the message
      if (!shareUrl) {
        await Share.share({
          message: message,
          title: 'Share Post',
        });
        return;
      }

      // Check if URL is a local file (file://) or remote (http://)
      const isLocalFile = shareUrl.startsWith('file://') || shareUrl.startsWith('/');

      if (isLocalFile) {
        // For local files, use expo-sharing if available
        if (await Sharing.isAvailableAsync()) {
          try {
            await Sharing.shareAsync(shareUrl, {
              mimeType:
                post.type === 'video'
                  ? 'video/mp4'
                  : post.type === 'image'
                    ? 'image/jpeg'
                    : 'application/pdf',
              dialogTitle: 'Share Post',
            });
          } catch (shareError) {
            // Fallback to text sharing if file sharing fails
            await Share.share({
              message: `${message}\n${shareUrl}`,
              title: 'Share Post',
            });
          }
        } else {
          // Fallback to text sharing
          await Share.share({
            message: `${message}\n${shareUrl}`,
            title: 'Share Post',
          });
        }
      } else {
        // For remote URLs, use text sharing with the URL
        const shareOptions: any = {
          message: `${message}\n\n${shareUrl}`,
          title: 'Share Post',
        };

        // iOS supports url parameter for better sharing
        if (Platform.OS === 'ios') {
          shareOptions.url = shareUrl;
        }

        await Share.share(shareOptions);
      }
    } catch (error: any) {
      console.error('Share error:', error);
      // Show user-friendly error only if user didn't cancel
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage && !errorMessage.includes('cancel') && !errorMessage.includes('dismiss')) {
        Toast.show({
          type: 'error',
          text1: 'Share Failed',
          text2: 'Unable to share post. Please try again.',
        });
      }
    }
  };

  const handleOpenDocument = () => {
    if (post.documentUrl) {
      Linking.openURL(post.documentUrl);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          activeOpacity={0.7}
          onPress={() => {
            if (post.userId) {
              navigation.navigate(ROUTES.USER_PROFILE, { userId: post.userId });
            }
          }}
        >
          {post.userAvatar ? (
            <Image source={{ uri: post.userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#8E8E93" />
            </View>
          )}
          <View style={styles.userInfoText}>
            <Text style={styles.userName}>{post.userName}</Text>
            <Text style={styles.time}>{formatDate(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {!isOwnPost && (
            <TouchableOpacity
              style={[
                styles.followButton,
                post.isFollowing && styles.followingButton,
              ]}
              onPress={() => {
                if (onFollow && post.userId) {
                  onFollow(post.userId, post.isFollowing || false);
                } else {
                  // Fallback: navigate to user profile if onFollow is not provided
                  if (post.userId) {
                    navigation.navigate(ROUTES.USER_PROFILE, { userId: post.userId });
                  }
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.followButtonText,
                  post.isFollowing && styles.followingButtonText,
                ]}
              >
                {post.isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
          {!isOwnPost && (
            <TouchableOpacity onPress={handleShare} style={styles.moreButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
            </TouchableOpacity>
          )}
          {isOwnPost && showMenu && (
            <TouchableOpacity
              onPress={() => setShowMenuModal(true)}
              style={styles.moreButton}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
            </TouchableOpacity>
          )}
          {isOwnPost && !showMenu && (
            <TouchableOpacity onPress={handleShare} style={styles.moreButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#000000" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Media Display */}
      {post.type === 'image' && post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={styles.media}
          resizeMode="cover"
          onError={(e) => {
            console.error('Image load error:', e.nativeEvent.error);
          }}
        />
      ) : post.type === 'video' && post.videoUrl ? (
        <View style={styles.videoContainer}>
          <TouchableOpacity
            style={styles.videoTouchArea}
            onPress={(e) => {
              e?.stopPropagation?.();
              handleVideoPress(e);
            }}
            onLongPress={() => {
              // Clear any existing timeout
              if (controlsTimeout) {
                clearTimeout(controlsTimeout);
                setControlsTimeout(null);
              }
              const newShowControls = !showControls;
              setShowControls(newShowControls);
              setShowPlayIcon(newShowControls); // Show/hide play icon with controls
              // Auto-hide after 3 seconds if showing controls
              if (newShowControls) {
                const timeout = setTimeout(() => {
                  setShowControls(false);
                  setShowPlayIcon(false);
                }, 3000);
                setControlsTimeout(timeout);
              }
            }}
            activeOpacity={1}
            delayLongPress={500}
          >
            <VideoView
              player={player!}
              style={styles.media}
              fullscreenOptions={{
                enterFullscreen: true,
                exitFullscreen: true,
              }}
              allowsPictureInPicture
              nativeControls={false}
              contentFit="cover"
            />
            {/* Mute/Unmute Button */}
            <TouchableOpacity
              style={styles.muteButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Play/Pause Overlay - Auto-hides after 3 seconds */}
            {showPlayIcon && (
              <TouchableOpacity
                style={styles.playOverlay}
                onPress={handleVideoPress}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isPlaying ? "pause-circle" : "play-circle"}
                  size={64}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            {/* Play/Pause Indicator (small icon) */}
            {showControls && (
              <TouchableOpacity
                style={styles.controlsIndicator}
                onPress={handleVideoPress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={16}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            {/* Duration Badge */}
            {post.videoDuration && (
              <View style={styles.durationBadge}>
                <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                <Text style={styles.durationText}>
                  {Math.floor(post.videoDuration / 60)}:
                  {Math.floor(post.videoDuration % 60)
                    .toString()
                    .padStart(2, '0')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : post.type === 'document' && post.documentUrl ? (
        <TouchableOpacity
          style={styles.documentContainer}
          onPress={handleOpenDocument}
        >
          <Ionicons
            name={
              post.documentType === 'pdf'
                ? 'document-text'
                : post.documentType === 'text'
                  ? 'document'
                  : 'document-attach'
            }
            size={64}
            color="#007AFF"
          />
          <Text style={styles.documentText}>Tap to open document</Text>
          <Text style={styles.documentType}>
            {post.documentType?.toUpperCase() || 'DOCUMENT'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.mediaPlaceholder}>
          <Ionicons name="image-outline" size={48} color="#8E8E93" />
          <Text style={styles.mediaPlaceholderText}>Media not available</Text>
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onLike}
            activeOpacity={0.7}
          >
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={28}
              color={post.isLiked ? '#FF3B30' : '#000000'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onComment}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={28} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons name="paper-plane-outline" size={28} color="#000000" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="bookmark-outline" size={28} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* Likes Count */}
      {post.likes > 0 && (
        <View style={styles.likesContainer}>
          <Text style={styles.likesText}>
            {post.likes} {post.likes === 1 ? 'like' : 'likes'}
          </Text>
        </View>
      )}
      {post.caption && (
        <View style={styles.caption}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUser}>{post.userName}</Text> {post.caption}
          </Text>
        </View>
      )}

      {/* View Comments */}
      {post.comments > 0 && (
        <TouchableOpacity
          style={styles.viewComments}
          onPress={onComment}
          activeOpacity={0.7}
        >
          <Text style={styles.viewCommentsText}>
            View all {post.comments} {post.comments === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Edit/Delete Menu Modal (only in profile section) */}
      {isOwnPost && showMenu && (
        <Modal
          visible={showMenuModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowMenuModal(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowMenuModal(false)}
          >
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenuModal(false);
                  if (onEdit && post.id) {
                    onEdit(post.id, post.caption || '');
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={24} color="#007AFF" />
                <Text style={styles.menuItemText}>Edit Post</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenuModal(false);
                  if (onDelete && post.id) {
                    Alert.alert(
                      'Delete Post',
                      'Are you sure you want to delete this post?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => onDelete(post.id),
                        },
                      ]
                    );
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                <Text style={[styles.menuItemText, styles.deleteMenuText]}>Delete Post</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, styles.cancelMenuItem]}
                onPress={() => setShowMenuModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelMenuText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfoText: {
    flex: 1,
    marginLeft: 12,
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
    marginTop: 2,
  },
  followersText: {
    fontSize: 11,
    color: '#8E8E93',
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    minWidth: 90,
    justifyContent: 'center',
  },
  followingButton: {
    backgroundColor: '#E5E5EA',
    borderWidth: 1,
    borderColor: '#C7C7CC',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#000000',
  },
  followersText: {
    fontSize: 11,
    color: '#8E8E93',
    marginLeft: 4,
  },
  moreButton: {
    padding: 4,
  },
  shareButton: {
    padding: 4,
  },
  ownPostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 8,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  media: {
    width: '100%',
    height: 400,
    backgroundColor: '#000000',
  },
  videoContainer: {
    position: 'relative',
    backgroundColor: '#000000',
  },
  videoTouchArea: {
    width: '100%',
    height: 400,
    position: 'relative',
  },
  muteButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  playOverlayHidden: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0,
  },
  controlsIndicator: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 6,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  documentContainer: {
    width: '100%',
    height: 400,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  documentText: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 12,
    fontWeight: '600',
  },
  documentType: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 400,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
  likesContainer: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  caption: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  captionText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },
  captionUser: {
    fontWeight: '600',
  },
  captionContent: {
    fontWeight: '400',
  },
  viewComments: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  viewCommentsText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#000000',
  },
  deleteMenuText: {
    color: '#FF3B30',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 20,
  },
  cancelMenuItem: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 16,
    alignItems: 'center',
  },
  cancelMenuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
});

export default PostCard;

