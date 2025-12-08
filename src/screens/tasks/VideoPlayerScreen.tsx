import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, AppState } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { useAppDispatch } from '@store/hooks';
import { completeTask, fetchTaskById } from '@store/slices/taskSlice';
import { addCoins } from '@store/slices/walletSlice';
import { updateUserCoins } from '@store/slices/authSlice';
import { formatCoins, formatTime } from '@utils/validation';
import { validateTaskCompletion } from '@utils/helpers';
import { COIN_VALUES, VIDEO_WATCH_PERCENTAGE } from '@constants';
import Button from '@components/common/Button';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const VideoPlayerScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { task } = route.params;
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchProgress, setWatchProgress] = useState(0);
  const [watchDuration, setWatchDuration] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [canComplete, setCanComplete] = useState(false);
  const [youtubeOpenedAt, setYoutubeOpenedAt] = useState<number | null>(null);
  const [timeSpentWatching, setTimeSpentWatching] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  // Check if video URL is an Instagram URL
  const isInstagramUrl = task.videoUrl && (
    task.videoUrl.includes('instagram.com') ||
    task.videoUrl.includes('instagr.am')
  );

  // Check if video URL is a YouTube URL
  const isYouTubeUrl = task.videoUrl && (
    task.videoUrl.includes('youtube.com') ||
    task.videoUrl.includes('youtu.be') ||
    task.videoUrl.includes('youtube.com/shorts')
  );

  // External URLs that cannot be played directly
  const isExternalUrl = isInstagramUrl || isYouTubeUrl;

  // Track app state changes to detect when user returns from YouTube
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (isYouTubeUrl && youtubeOpenedAt) {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          // User returned to app - calculate time spent
          const timeSpent = Math.floor((Date.now() - youtubeOpenedAt) / 1000);
          setTimeSpentWatching(timeSpent);
          
          // Check if enough time was spent watching
          const requiredTime = task.videoDuration || 30; // Default 30 seconds
          const minWatchTime = Math.floor(requiredTime * (VIDEO_WATCH_PERCENTAGE / 100));
          
          if (timeSpent >= minWatchTime && !hasCompleted) {
            // Auto-complete the task
            handleAutoComplete();
          } else if (timeSpent > 0) {
            // Show progress
            Toast.show({
              type: 'info',
              text1: 'Watch Time',
              text2: `You watched for ${formatTime(timeSpent)}. Need ${formatTime(minWatchTime)} to complete.`,
            });
          }
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isYouTubeUrl, youtubeOpenedAt, hasCompleted, task.videoDuration]);

  // Refresh only this task when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (task.id && !hasCompleted) {
        dispatch(fetchTaskById(task.id));
      }
    }, [task.id, hasCompleted, dispatch])
  );

  useEffect(() => {
    // If external URL (Instagram or YouTube), show message and allow opening in browser
    if (isExternalUrl) {
      const platform = isInstagramUrl ? 'Instagram' : 'YouTube';
      Alert.alert(
        `${platform} Video`,
        `This video is hosted on ${platform}. Please watch it in the ${platform} app or browser, then return here to complete the task.`,
        [
          {
            text: 'Open in Browser',
            onPress: async () => {
              try {
                const url = task.videoUrl.startsWith('http') 
                  ? task.videoUrl 
                  : `https://${task.videoUrl}`;
                await Linking.openURL(url);
                // Track when YouTube was opened
                if (isYouTubeUrl) {
                  setYoutubeOpenedAt(Date.now());
                }
              } catch (error) {
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to open video URL',
                });
              }
            },
          },
          {
            text: 'I Watched It',
            onPress: () => {
              // Allow manual completion for external videos
              setCanComplete(true);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, [isExternalUrl]);

  useEffect(() => {
    if (task.videoDuration && watchProgress > 0) {
      const percentage = (watchProgress / task.videoDuration) * 100;
      if (percentage >= VIDEO_WATCH_PERCENTAGE && !hasCompleted) {
        setCanComplete(true);
      }
    }
  }, [watchProgress, task.videoDuration, hasCompleted]);

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handlePlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setWatchProgress(status.positionMillis / 1000);
      setWatchDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
    }
  };

  const handleAutoComplete = async () => {
    if (hasCompleted) return;

    try {
      const result = await dispatch(completeTask({ taskId: task.id })).unwrap();
      const coinsEarned = result.result?.coins || result.coins || task.coins || COIN_VALUES.WATCH_VIDEO;
      dispatch(addCoins(coinsEarned));
      dispatch(updateUserCoins(coinsEarned));
      setHasCompleted(true);
      Toast.show({
        type: 'success',
        text1: 'Task Completed Automatically!',
        text2: `You earned ${formatCoins(coinsEarned)} coins!`,
      });
      // Refresh task to update completion status
      await dispatch(fetchTaskById(task.id));
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error || 'Failed to complete task',
      });
    }
  };

  const handleCompleteTask = async () => {
    if (!canComplete || hasCompleted) return;

    // For external videos (Instagram/YouTube), skip validation
    if (!isExternalUrl) {
      const isValid = validateTaskCompletion(
        watchProgress,
        task.videoDuration || watchDuration,
        VIDEO_WATCH_PERCENTAGE
      );

      if (!isValid) {
        Alert.alert(
          'Watch More',
          `You need to watch at least ${VIDEO_WATCH_PERCENTAGE}% of the video to complete this task.`
        );
        return;
      }
    }

    try {
      const result = await dispatch(completeTask({ taskId: task.id })).unwrap();
      // completeTask returns { taskId, result: { coins, message } }
      const coinsEarned = result.result?.coins || result.coins || task.coins || COIN_VALUES.WATCH_VIDEO;
      dispatch(addCoins(coinsEarned));
      dispatch(updateUserCoins(coinsEarned));
      setHasCompleted(true);
      Toast.show({
        type: 'success',
        text1: 'Task Completed!',
        text2: `You earned ${formatCoins(coinsEarned)} coins!`,
      });
      // Refresh only this task
      await dispatch(fetchTaskById(task.id));
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error || 'Failed to complete task',
      });
    }
  };

  const progressPercentage = task.videoDuration
    ? (watchProgress / task.videoDuration) * 100
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        {isExternalUrl ? (
          <View style={styles.placeholder}>
            <Ionicons 
              name={isInstagramUrl ? "logo-instagram" : "logo-youtube"} 
              size={64} 
              color={isInstagramUrl ? "#E4405F" : "#FF0000"} 
            />
            <Text style={styles.placeholderText}>
              {isInstagramUrl ? 'Instagram' : 'YouTube'} Video
            </Text>
            <Text style={styles.placeholderSubtext}>
              This video is hosted on {isInstagramUrl ? 'Instagram' : 'YouTube'}
            </Text>
            <TouchableOpacity
              style={styles.openButton}
              onPress={async () => {
                try {
                  const url = task.videoUrl.startsWith('http') 
                    ? task.videoUrl 
                    : `https://${task.videoUrl}`;
                  await Linking.openURL(url);
                  // Track when YouTube was opened
                  if (isYouTubeUrl) {
                    setYoutubeOpenedAt(Date.now());
                  }
                } catch (error) {
                  Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to open video URL',
                  });
                }
              }}
            >
              <Ionicons name="open-outline" size={20} color="#FFFFFF" />
              <Text style={styles.openButtonText}>Open in Browser</Text>
            </TouchableOpacity>
            {isYouTubeUrl && youtubeOpenedAt && timeSpentWatching > 0 && (
              <View style={styles.watchTimeInfo}>
                <Text style={styles.watchTimeText}>
                  Watch Time: {formatTime(timeSpentWatching)}
                </Text>
                {task.videoDuration && (
                  <Text style={styles.watchTimeText}>
                    Required: {formatTime(Math.floor(task.videoDuration * (VIDEO_WATCH_PERCENTAGE / 100)))}
                  </Text>
                )}
              </View>
            )}
            <Text style={styles.instructionText}>
              {isYouTubeUrl 
                ? 'Watch the video in YouTube, then return here. Task will complete automatically!'
                : 'Watch the video, then return here and click "Complete Task"'}
            </Text>
          </View>
        ) : task.videoUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: task.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="videocam-off" size={64} color="#8E8E93" />
            <Text style={styles.placeholderText}>Video not available</Text>
          </View>
        )}

        {!isExternalUrl && (
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            disabled={!task.videoUrl}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={48}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.controls}>
        {!isInstagramUrl && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progressPercentage, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {formatTime(Math.floor(watchProgress))} /{' '}
              {formatTime(task.videoDuration || Math.floor(watchDuration))}
            </Text>
          </View>
        )}

        <View style={styles.info}>
          <View style={styles.coinInfo}>
            <Ionicons name="cash" size={20} color="#FFD700" />
            <Text style={styles.coinText}>
              Earn {formatCoins(task.coins)} coins
            </Text>
          </View>
          {isInstagramUrl ? (
            <Text style={styles.requirement}>
              Watch the video in browser, then return to complete
            </Text>
          ) : (
            <Text style={styles.requirement}>
              Watch at least {VIDEO_WATCH_PERCENTAGE}% to complete
            </Text>
          )}
        </View>

        {hasCompleted ? (
          <View style={styles.completedContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#34C759" />
            <Text style={styles.completedText}>Task Completed!</Text>
          </View>
        ) : (
          <Button
            title={canComplete ? 'Complete Task' : 'Watch More to Complete'}
            onPress={handleCompleteTask}
            disabled={!canComplete}
            style={styles.completeButton}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderSubtext: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4405F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    opacity: 0.8,
    paddingHorizontal: 32,
  },
  watchTimeInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginHorizontal: 32,
  },
  watchTimeText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 2,
  },
  playButton: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  info: {
    marginBottom: 16,
  },
  coinInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  coinText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500',
    marginLeft: 8,
  },
  requirement: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  completeButton: {
    marginTop: 8,
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  completedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34C759',
    marginTop: 12,
  },
});

export default VideoPlayerScreen;

