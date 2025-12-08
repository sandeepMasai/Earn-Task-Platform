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
  SafeAreaView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminTaskService, AdminTask } from '@services/adminTaskService';
import { formatCoins, formatDate } from '@utils/validation';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const AdminTasksScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = async () => {
    try {
      const data = await adminTaskService.getAllTasks();
      setTasks(data);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load tasks',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
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

  const handleViewDetails = (task: AdminTask) => {
    navigation.navigate(ROUTES.ADMIN_TASK_DETAILS, { taskId: task.id });
  };

  const handleEdit = (task: AdminTask) => {
    navigation.navigate(ROUTES.ADMIN_EDIT_TASK, { taskId: task.id });
  };

  const handleDelete = async (task: AdminTask) => {
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
              await adminTaskService.deleteTask(task.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Task deleted successfully',
              });
              loadTasks();
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

  const handleToggleActive = async (task: AdminTask) => {
    try {
      await adminTaskService.updateTask(task.id, { isActive: !task.isActive });
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Task ${!task.isActive ? 'activated' : 'deactivated'} successfully`,
      });
      loadTasks();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update task',
      });
    }
  };

  const renderTaskCard = ({ item: task }: { item: AdminTask }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => handleViewDetails(task)}
      activeOpacity={0.7}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskTypeContainer}>
          <Ionicons name={getTaskTypeIcon(task.type)} size={24} color="#007AFF" />
          <View style={styles.taskTypeInfo}>
            <Text style={styles.taskType}>{getTaskTypeLabel(task.type)}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, task.isActive ? styles.activeBadge : styles.inactiveBadge]}>
                <Text style={[styles.statusText, task.isActive ? styles.activeText : styles.inactiveText]}>
                  {task.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.taskActions}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleToggleActive(task);
            }}
            style={styles.actionButton}
          >
            <Ionicons
              name={task.isActive ? 'eye-off' : 'eye'}
              size={20}
              color={task.isActive ? '#8E8E93' : '#007AFF'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleEdit(task);
            }}
            style={styles.actionButton}
          >
            <Ionicons name="create-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleDelete(task);
            }}
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.taskTitle}>{task.title}</Text>
      <Text style={styles.taskDescription} numberOfLines={2}>
        {task.description}
      </Text>

      <View style={styles.taskStats}>
        <View style={styles.statItem}>
          <Ionicons name="diamond-outline" size={16} color="#FF9500" />
          <Text style={styles.statText}>{formatCoins(task.coins)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="people-outline" size={16} color="#34C759" />
          <Text style={styles.statText}>{task.completionCount} completed</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="cash-outline" size={16} color="#5856D6" />
          <Text style={styles.statText}>{formatCoins(task.totalCoinsGiven)} given</Text>
        </View>
      </View>

      <Text style={styles.taskDate}>Created: {formatDate(task.createdAt)}</Text>
    </TouchableOpacity>
  );

  if (isLoading && tasks.length === 0) {
    return <LoadingSpinner fullScreen />;
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
        <Text style={styles.title}>Task Management</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={tasks}
        renderItem={renderTaskCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={64} color="#8E8E93" />
            <Text style={styles.emptyText}>No tasks found</Text>
            <Text style={styles.emptySubtext}>Create your first task to get started</Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <SafeAreaView style={styles.fabContainer} edges={['bottom']}>
        <TouchableOpacity
          onPress={() => navigation.navigate(ROUTES.ADMIN_CREATE_TASK)}
          style={styles.fabButton}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>
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
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
  },
  placeholder: {
    width: 32,
  },
  listContent: {
    paddingBottom: 100, // Space for FAB
  },
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    pointerEvents: 'box-none',
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  taskCard: {
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
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskTypeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  taskType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  taskActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  taskDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    lineHeight: 20,
  },
  taskStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '500',
  },
  taskDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
});

export default AdminTasksScreen;

