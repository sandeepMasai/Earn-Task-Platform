import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchTaskById, completeTask } from '@store/slices/taskSlice';
import { formatCoins } from '@utils/validation';
import { ROUTES, TASK_TYPES } from '@constants';
import Button from '@components/common/Button';
import LoadingSpinner from '@components/common/LoadingSpinner';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const TaskDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { currentTask, isLoading } = useAppSelector((state) => state.tasks);
  const taskId = route.params?.taskId;

  useEffect(() => {
    if (taskId) {
      dispatch(fetchTaskById(taskId));
    }
  }, [dispatch, taskId]);

  const handleStartTask = () => {
    if (!currentTask) return;

    if (currentTask.type === TASK_TYPES.WATCH_VIDEO) {
      navigation.navigate(ROUTES.VIDEO_PLAYER, { task: currentTask });
    } else if (
      currentTask.type === TASK_TYPES.INSTAGRAM_FOLLOW ||
      currentTask.type === TASK_TYPES.INSTAGRAM_LIKE
    ) {
      // Open Instagram URL in WebView or external browser
      handleInstagramTask();
    } else if (currentTask.type === TASK_TYPES.YOUTUBE_SUBSCRIBE) {
      // Open YouTube URL
      handleYouTubeTask();
    }
  };

  const handleInstagramTask = async () => {
    if (!currentTask?.instagramUrl) return;

    // In a real app, you would open Instagram app or WebView
    // For now, we'll complete the task after user confirms
    try {
      await dispatch(completeTask({ taskId: currentTask.id })).unwrap();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `You earned ${formatCoins(currentTask.coins)} coins!`,
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error || 'Failed to complete task',
      });
    }
  };

  const handleYouTubeTask = async () => {
    if (!currentTask?.youtubeUrl) return;

    // Similar to Instagram task
    try {
      await dispatch(completeTask({ taskId: currentTask.id })).unwrap();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `You earned ${formatCoins(currentTask.coins)} coins!`,
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error || 'Failed to complete task',
      });
    }
  };

  if (isLoading || !currentTask) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {currentTask.thumbnail && (
        <Image source={{ uri: currentTask.thumbnail }} style={styles.thumbnail} />
      )}

      <View style={styles.details}>
        <View style={styles.header}>
          <Text style={styles.title}>{currentTask.title}</Text>
          {currentTask.isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              <Text style={styles.completedText}>Completed</Text>
            </View>
          )}
        </View>

        <View style={styles.coinBadge}>
          <Ionicons name="cash" size={24} color="#FFD700" />
          <Text style={styles.coinText}>{formatCoins(currentTask.coins)} Coins</Text>
        </View>

        <Text style={styles.description}>{currentTask.description}</Text>

        {!currentTask.isCompleted && (
          <Button
            title="Start Task"
            onPress={handleStartTask}
            style={styles.startButton}
          />
        )}

        {currentTask.isCompleted && currentTask.completedAt && (
          <View style={styles.completedInfo}>
            <Text style={styles.completedInfoText}>
              Completed on {new Date(currentTask.completedAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingBottom: 20,
  },
  thumbnail: {
    width: '100%',
    height: 250,
    backgroundColor: '#F2F2F7',
  },
  details: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C75920',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  completedText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginLeft: 6,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  coinText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9500',
    marginLeft: 8,
  },
  description: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
    marginBottom: 24,
  },
  startButton: {
    marginTop: 8,
  },
  completedInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  completedInfoText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default TaskDetailsScreen;

