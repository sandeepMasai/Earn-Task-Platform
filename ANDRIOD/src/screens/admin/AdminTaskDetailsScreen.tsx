import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { adminTaskService, TaskDetails, TaskCompletion } from '@services/adminTaskService';
import { formatCoins, formatDate } from '@utils/validation';
import { ROUTES } from '../../constants/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const AdminTaskDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;

  const [task, setTask] = useState<TaskDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTaskDetails = async () => {
    try {
      const data = await adminTaskService.getTaskById(taskId);
      setTask(data);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load task details',
      });
      navigation.goBack();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTaskDetails();
  }, [taskId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTaskDetails();
  };

  const handleEdit = () => {
    navigation.navigate(ROUTES.ADMIN_EDIT_TASK, { taskId });
  };

  const handleDelete = () => {
    if (!task) return;

    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminTaskService.deleteTask(taskId);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Task deleted successfully',
              });
              navigation.goBack();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to delete task',
              });
            }
          },
        },
      ]
    );
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'watch_video':
        return 'play-circle';
      case 'instagram_follow':
        return 'logo-instagram';
      case 'instagram_like':
        return 'heart';
      case 'youtube_subscribe':
        return 'logo-youtube';
      case 'upload_post':
        return 'add-circle';
      default:
        return 'list';
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case 'watch_video':
        return 'Watch Video';
      case 'instagram_follow':
        return 'Instagram Follow';
      case 'instagram_like':
        return 'Instagram Like';
      case 'youtube_subscribe':
        return 'YouTube Subscribe';
      case 'upload_post':
        return 'Upload Post';
      default:
        return type;
    }
  };

  const renderCompletionItem = ({ item }: { item: TaskCompletion }) => (
    <View style={styles.completionCard}>
      <View style={styles.completionHeader}>
        <View style={styles.completionUserInfo}>
          <Text style={styles.completionUserName}>{item.userName}</Text>
          <Text style={styles.completionUserDetails}>
            @{item.userUsername} • ID: {item.userId.substring(0, 8)}...
          </Text>
          {item.userEmail && (
            <Text style={styles.completionUserEmail}>{item.userEmail}</Text>
          )}
        </View>
        <View style={styles.completionCoins}>
          <Ionicons name="diamond" size={20} color="#FF9500" />
          <Text style={styles.completionCoinsText}>{formatCoins(item.coinsEarned)}</Text>
        </View>
      </View>
      <Text style={styles.completionDate}>
        Completed: {formatDate(item.completedAt)}
      </Text>
    </View>
  );

  if (isLoading && !task) {
    return <LoadingSpinner fullScreen />;
  }

  if (!task) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Task not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Task Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionButton}>
            <Ionicons name="create-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Task Info Card */}
        <View style={styles.taskCard}>
          <View style={styles.taskHeader}>
            <View style={styles.taskTypeContainer}>
              <Ionicons name={getTaskTypeIcon(task.type)} size={32} color="#007AFF" />
              <View style={styles.taskTypeInfo}>
                <Text style={styles.taskType}>{getTaskTypeLabel(task.type)}</Text>
                <View style={[styles.statusBadge, task.isActive ? styles.activeBadge : styles.inactiveBadge]}>
                  <Text style={[styles.statusText, task.isActive ? styles.activeText : styles.inactiveText]}>
                    {task.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskDescription}>{task.description}</Text>

          <View style={styles.taskDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Coins Reward:</Text>
              <Text style={styles.detailValue}>{formatCoins(task.coins)}</Text>
            </View>
            {task.videoUrl && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Video URL:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{task.videoUrl}</Text>
              </View>
            )}
            {task.videoDuration && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Video Duration:</Text>
                <Text style={styles.detailValue}>{task.videoDuration} seconds</Text>
              </View>
            )}
            {task.instagramUrl && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Instagram URL:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{task.instagramUrl}</Text>
              </View>
            )}
            {task.youtubeUrl && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>YouTube URL:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{task.youtubeUrl}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created:</Text>
              <Text style={styles.detailValue}>{formatDate(task.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* Completion Statistics */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Completion Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color="#34C759" />
              <Text style={styles.statValue}>{task.completionCount}</Text>
              <Text style={styles.statLabel}>Completions</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="diamond" size={24} color="#FF9500" />
              <Text style={styles.statValue}>{formatCoins(task.totalCoinsGiven)}</Text>
              <Text style={styles.statLabel}>Total Coins Given</Text>
            </View>
          </View>
        </View>

        {/* Completions List */}
        <View style={styles.completionsSection}>
          <Text style={styles.sectionTitle}>
            Users Who Completed ({task.completions.length})
          </Text>
          {task.completions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>No users have completed this task yet</Text>
            </View>
          ) : (
            <FlatList
              data={task.completions}
              renderItem={renderCompletionItem}
              keyExtractor={(item, index) => `${item.userId}-${index}`}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
    marginTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
    marginTop: 20,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  actionButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskHeader: {
    marginBottom: 12,
  },
  taskTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTypeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  taskType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeBadge: {
    backgroundColor: '#D4EDDA',
  },
  inactiveBadge: {
    backgroundColor: '#F8D7DA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#155724',
  },
  inactiveText: {
    color: '#721C24',
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    marginTop: 20,
  },
  taskDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  taskDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    marginTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  completionsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    marginTop: 20,
  },
  completionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  completionUserInfo: {
    flex: 1,
  },
  completionUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  completionUserDetails: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  completionUserEmail: {
    fontSize: 12,
    color: '#8E8E93',
  },
  completionCoins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completionCoinsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500',
  },
  completionDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 32,
  },
});

export default AdminTaskDetailsScreen;

