import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, AppState } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useAppDispatch } from '@store/hooks';
import { completeTask, fetchTaskById } from '@store/slices/taskSlice';
import { addCoins } from '@store/slices/walletSlice';
import { addUserReward } from '@store/slices/authSlice';
import { formatCoins, formatTime } from '@utils/validation';
import { taskService } from '@services/taskService';
import { WatchProgress } from '@services/watchProgress';
import { Completion } from '@services/completion';
import type { RootStackParamList } from '@types';
import type { WatchSession } from '@services/watchTypes';
import { VIDEO_WATCH_PERCENTAGE } from '@constants';
import Button from '@components/common/Button';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const VideoPlayerScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'VideoPlayer'>>();
  const dispatch = useAppDispatch();
  const { task } = route.params;
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchProgress, setWatchProgress] = useState(0);
  const [watchDuration, setWatchDuration] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [canComplete, setCanComplete] = useState(false);
  const sessionRef = useRef<WatchSession | null>(null);
  const progressRef = useRef<WatchProgress | null>(null);
  const completionRef = useRef(new Completion());
  const [sessionReady, setSessionReady] = useState(false);
  const isInstagramUrl = /(?:instagram\.com|instagr\.am)/i.test(task.videoUrl || '');
  const isYouTubeUrl = /(?:youtube\.com|youtu\.be)/i.test(task.videoUrl || '');
  const isExternalUrl = isInstagramUrl || isYouTubeUrl;

  useEffect(() => {
    let mounted = true;
    sessionRef.current = null;
    setSessionReady(false);
    setCanComplete(false);
    setHasCompleted(false);
    completionRef.current = new Completion();
    if (!isExternalUrl) {
      taskService.startWatch(task.id).then(session => {
        if (!mounted) return;
        sessionRef.current = session;
        progressRef.current = new WatchProgress(task.id, session, taskService, (confirmed, recovered) => {
          if (!mounted) return;
          sessionRef.current = confirmed;
          setCanComplete(confirmed.accumulatedSeconds >= confirmed.requiredWatchSeconds);
          if (recovered) {
            setIsPlaying(false);
            void videoRef.current?.pauseAsync().then(() => videoRef.current?.setPositionAsync(confirmed.playbackPosition * 1000)).catch(() => {});
            Toast.show({ type: 'info', text1: 'Progress synchronized', text2: 'Resume playback from the saved position.' });
          }
        });
        setCanComplete(session.accumulatedSeconds >= session.requiredWatchSeconds);
        setSessionReady(true);
        videoRef.current?.setPositionAsync(session.playbackPosition * 1000).catch(() => {});
      }).catch(error => Toast.show({ type: 'error', text1: 'Cannot start watch session', text2: error.message }));
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { videoRef.current?.pauseAsync(); setIsPlaying(false); }
    });
    return () => { mounted = false; progressRef.current?.dispose(); progressRef.current = null; subscription.remove(); };
  }, [task.id, isExternalUrl]);

  const handlePlayPause = async () => {
    if (!videoRef.current || !sessionReady) return;
    if (isPlaying) await videoRef.current.pauseAsync();
    else await videoRef.current.playAsync();
    setIsPlaying(!isPlaying);
  };

  const handlePlaybackStatusUpdate = async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    const position = status.positionMillis / 1000;
    setWatchProgress(position);
    setWatchDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
    if (status.didJustFinish) setIsPlaying(false);
    if (!progressRef.current || hasCompleted || (!status.isPlaying && !status.didJustFinish)) return;
    try {
      await progressRef.current.update(position, status.didJustFinish);
    } catch (error) {
      await videoRef.current?.pauseAsync();
      setIsPlaying(false);
      Toast.show({ type: 'error', text1: 'Watch progress could not be saved', text2: error instanceof Error ? error.message : 'Please reopen the video and try again.' });
    }
  };

  const handleCompleteTask = async () => {
    if (!canComplete || hasCompleted || !sessionRef.current) return;
    try {
      const sessionId = sessionRef.current.sessionId;
      const result = await completionRef.current.run(
        async () => (await dispatch(completeTask({ taskId: task.id, data: { sessionId } })).unwrap()).result,
        coins => { dispatch(addCoins(coins)); dispatch(addUserReward(coins)); }
      );
      const coinsEarned = result.coins;
      setHasCompleted(true);
      Toast.show({ type: 'success', text1: 'Task completed', text2: `You earned ${formatCoins(coinsEarned)} coins!` });
      await dispatch(fetchTaskById(task.id));
    } catch (error: unknown) {
      Toast.show({ type: 'error', text1: 'Could not complete task', text2: String(error) });
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
                  if (!task.videoUrl) return;
                  const url = task.videoUrl.startsWith('http') 
                    ? task.videoUrl 
                    : `https://${task.videoUrl}`;
                  await Linking.openURL(url);

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
            <Text style={styles.instructionText}>
              External playback cannot earn an automatic watch reward. This task needs an in-app video or an approved proof-review workflow.
            </Text>
          </View>
        ) : task.videoUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: task.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            onLoad={() => {
              const session = sessionRef.current;
              if (session) videoRef.current?.setPositionAsync(session.playbackPosition * 1000).catch(() => {});
            }}
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
            disabled={!task.videoUrl || !sessionReady}
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
              External playback requires a separate verification method
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

