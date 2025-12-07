import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { useAppDispatch } from '@store/hooks';
import { completeTask } from '@store/slices/taskSlice';
import { addCoins } from '@store/slices/walletSlice';
import { updateUserCoins } from '@store/slices/authSlice';
import { formatCoins, formatTime } from '@utils/validation';
import { validateTaskCompletion, VIDEO_WATCH_PERCENTAGE } from '@utils/helpers';
import { COIN_VALUES } from '@constants';
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

  const handleCompleteTask = async () => {
    if (!canComplete || hasCompleted) return;

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

    try {
      const result = await dispatch(completeTask({ taskId: task.id })).unwrap();
      dispatch(addCoins(result.coins || COIN_VALUES.WATCH_VIDEO));
      dispatch(updateUserCoins(result.coins || COIN_VALUES.WATCH_VIDEO));
      setHasCompleted(true);
      Toast.show({
        type: 'success',
        text1: 'Task Completed!',
        text2: `You earned ${formatCoins(result.coins || COIN_VALUES.WATCH_VIDEO)} coins!`,
      });
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
        {task.videoUrl ? (
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
      </View>

      <View style={styles.controls}>
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

        <View style={styles.info}>
          <View style={styles.coinInfo}>
            <Ionicons name="cash" size={20} color="#FFD700" />
            <Text style={styles.coinText}>
              Earn {formatCoins(task.coins)} coins
            </Text>
          </View>
          <Text style={styles.requirement}>
            Watch at least {VIDEO_WATCH_PERCENTAGE}% to complete
          </Text>
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

