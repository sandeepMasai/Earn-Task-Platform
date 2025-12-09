import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { creatorService, CreatorDashboard } from '@services/creatorService';
import { formatCoins, formatTime } from '@utils/validation';
import { ROUTES, API_BASE_URL } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

interface CreatorTask {
  id: string;
  type: string;
  title: string;
  description: string;
  rewardPerUser: number;
  maxUsers: number;
  coinsUsed: number;
  totalBudget: number;
  videoUrl?: string;
  videoDuration?: number;
  instagramUrl?: string;
  youtubeUrl?: string;
  thumbnail?: string;
  createdAt: string;
  isActive: boolean;
  completions: number;
}

const CreatorDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [tasks, setTasks] = useState<CreatorTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 10;

  useEffect(() => {
    loadDashboard();
    loadTasks();
  }, []);

  // Refresh dashboard when screen comes into focus (e.g., after coin request approval)
  useFocusEffect(
    React.useCallback(() => {
      loadDashboard();
      loadTasks();
    }, [])
  );

  const loadDashboard = async () => {
    try {
      const data = await creatorService.getCreatorDashboard();
      setDashboard(data);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load dashboard',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadTasks = async () => {
    try {
      const creatorTasks = await creatorService.getCreatorTasks();
      // Sort tasks: active first, then by creation date (newest first)
      const sortedTasks = [...creatorTasks].sort((a, b) => {
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setTasks(sortedTasks);
    } catch (error: any) {
      console.error('Failed to load tasks:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load tasks',
      });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
    loadTasks();
  };

  const handleTaskPress = (task: CreatorTask) => {
    // Show action sheet for view/edit/delete
    Alert.alert(
      task.title,
      'Choose an action',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View Details',
          onPress: () => {
            // Navigate to task details or show modal
            handleViewTaskDetails(task);
          },
        },
        {
          text: 'Edit',
          onPress: () => handleEditTask(task),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteTask(task),
        },
      ],
      { cancelable: true }
    );
  };

  const handleViewTaskDetails = (task: CreatorTask) => {
    Alert.alert(
      task.title,
      `Type: ${getTaskTypeLabel(task.type)}\n\n${task.description}\n\nReward: ${formatCoins(task.rewardPerUser)} per user\nMax Users: ${task.maxUsers}\nCompletions: ${task.completions}/${task.maxUsers}\nCoins Used: ${formatCoins(task.coinsUsed)}/${formatCoins(task.totalBudget)}\nStatus: ${task.isActive ? 'Active' : 'Inactive'}\nCreated: ${new Date(task.createdAt).toLocaleDateString()}`,
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => handleEditTask(task),
        },
      ]
    );
  };

  const handleEditTask = (task: CreatorTask) => {
    navigation.navigate(ROUTES.CREATOR_EDIT_TASK, { taskId: task.id, task });
  };

  const handleDeleteTask = (task: CreatorTask) => {
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"?\n\nThis action cannot be undone. Any unused coins will be refunded to your creator wallet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await creatorService.deleteTask(task.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: result.message || 'Task deleted successfully',
              });
              // Refresh both tasks and dashboard
              await Promise.all([loadTasks(), loadDashboard()]);
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

  const getTaskTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      watch_video: 'Watch Video',
      instagram_follow: 'Instagram Follow',
      instagram_like: 'Instagram Like',
      youtube_subscribe: 'YouTube Subscribe',
      upload_post: 'Upload Post',
    };
    return typeMap[type] || type;
  };

  const getImageUrl = (imagePath?: string): string | null => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Handle relative paths
    const baseUrl = API_BASE_URL.replace('/api', '');
    return imagePath.startsWith('/') ? `${baseUrl}${imagePath}` : `${baseUrl}/${imagePath}`;
  };

  const getFilteredTasks = (): CreatorTask[] => {
    let filtered = tasks;

    // Apply status filter
    if (taskFilter === 'active') {
      filtered = filtered.filter((t) => t.isActive);
    } else if (taskFilter === 'inactive') {
      filtered = filtered.filter((t) => !t.isActive);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((task) =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        getTaskTypeLabel(task.type).toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredTasks = useMemo(() => getFilteredTasks(), [tasks, taskFilter, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [taskFilter, searchQuery]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const StatCard = ({ icon, label, value, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (isLoading && !dashboard) {
    return <LoadingSpinner fullScreen />;
  }

  if (!dashboard) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.title}>Creator Dashboard</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate(ROUTES.CREATOR_TASK_SUBMISSIONS)}
            >
              <Ionicons name="document-text" size={24} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate(ROUTES.CREATOR_CREATE_TASK)}
            >
              <Ionicons name="add-circle" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Creator Wallet */}
        <View style={styles.section}>
          <View style={styles.walletCard}>
            <View style={styles.walletHeader}>
              <Ionicons name="wallet" size={32} color="#007AFF" />
              <View style={styles.walletInfo}>
                <Text style={styles.walletLabel}>Creator Wallet</Text>
                <Text style={styles.walletAmount}>
                  {formatCoins(dashboard.creatorWallet || 0)} Coins
                </Text>
                <Text style={styles.walletValue}>
                  ≈ ₹{((dashboard.creatorWallet || 0) / 100).toFixed(2)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.addCoinsButton}
              onPress={() => navigation.navigate(ROUTES.CREATOR_REQUEST_COINS)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.addCoinsText}>Add Coins</Text>
            </TouchableOpacity>
            {dashboard.creatorWallet === 0 && (
              <View style={styles.emptyWalletInfo}>
                <Ionicons name="information-circle-outline" size={20} color="#FF9500" />
                <Text style={styles.emptyWalletText}>
                  Your wallet is empty. Request coins to start creating tasks.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Links</Text>
          <View style={styles.linksCard}>
            {dashboard.links.youtubeUrl && (
              <View style={styles.linkItem}>
                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                <Text style={styles.linkText} numberOfLines={1}>
                  {dashboard.links.youtubeUrl}
                </Text>
              </View>
            )}
            {dashboard.links.instagramUrl && (
              <View style={styles.linkItem}>
                <Ionicons name="logo-instagram" size={20} color="#E4405F" />
                <Text style={styles.linkText} numberOfLines={1}>
                  {dashboard.links.instagramUrl}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsRow}>
            <StatCard
              icon="list"
              label="Total Tasks"
              value={dashboard.stats.totalTasks}
              color="#007AFF"
            />
            <StatCard
              icon="checkmark-circle"
              label="Active Tasks"
              value={dashboard.stats.activeTasks}
              color="#34C759"
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon="people"
              label="Total Completions"
              value={dashboard.stats.totalCompletions}
              color="#5856D6"
            />
            <StatCard
              icon="cash"
              label="Coins Spent"
              value={formatCoins(dashboard.stats.totalCoinsSpent)}
              color="#FF9500"
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon="person"
              label="Unique Users"
              value={dashboard.stats.uniqueUsers}
              color="#AF52DE"
            />
            <StatCard
              icon="logo-youtube"
              label="YouTube Subs"
              value={dashboard.stats.youtubeSubscribers}
              color="#FF0000"
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon="time"
              label="Total Watch Time"
              value={formatTime(dashboard.stats.totalWatchTime)}
              color="#5AC8FA"
            />
          </View>
        </View>

        {/* My Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Tasks ({tasks.length})</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate(ROUTES.CREATOR_CREATE_TASK)}
              style={styles.addTaskButton}
            >
              <Ionicons name="add-circle" size={20} color="#007AFF" />
              <Text style={styles.addTaskText}>New Task</Text>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tasks by name, description, or type..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>

          {/* Task Filter */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, taskFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setTaskFilter('all')}
            >
              <Text style={[styles.filterText, taskFilter === 'all' && styles.filterTextActive]}>
                All ({tasks.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, taskFilter === 'active' && styles.filterButtonActive]}
              onPress={() => setTaskFilter('active')}
            >
              <Text style={[styles.filterText, taskFilter === 'active' && styles.filterTextActive]}>
                Active ({tasks.filter((t) => t.isActive).length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, taskFilter === 'inactive' && styles.filterButtonActive]}
              onPress={() => setTaskFilter('inactive')}
            >
              <Text style={[styles.filterText, taskFilter === 'inactive' && styles.filterTextActive]}>
                Inactive ({tasks.filter((t) => !t.isActive).length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Results Info */}
          {filteredTasks.length > 0 && (
            <Text style={styles.resultsInfo}>
              Showing {startIndex + 1}-{Math.min(endIndex, filteredTasks.length)} of {filteredTasks.length} tasks
              {searchQuery && ` matching "${searchQuery}"`}
            </Text>
          )}

          {paginatedTasks.length > 0 ? (
            paginatedTasks.map((task) => {
              const thumbnailUrl = getImageUrl(task.thumbnail);
              return (
                <View key={task.id} style={styles.taskCard}>
                  {thumbnailUrl && (
                    <TouchableOpacity
                      onPress={() => handleTaskPress(task)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: thumbnailUrl }}
                        style={styles.taskThumbnail}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  )}
                  <View style={styles.taskHeader}>
                    <TouchableOpacity
                      style={styles.taskHeaderLeft}
                      onPress={() => handleTaskPress(task)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      <View style={styles.taskMeta}>
                        <View style={[styles.taskBadge, task.isActive && styles.taskBadgeActive]}>
                          <Text style={[styles.taskBadgeText, task.isActive && styles.taskBadgeTextActive]}>
                            {task.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                        <Text style={styles.taskType}>{getTaskTypeLabel(task.type)}</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.taskActions}>
                      <TouchableOpacity
                        onPress={() => handleEditTask(task)}
                        style={styles.actionButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="create-outline" size={20} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteTask(task)}
                        style={styles.actionButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleTaskPress(task)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.taskDescription} numberOfLines={2}>
                      {task.description}
                    </Text>
                    <View style={styles.taskStats}>
                      <View style={styles.taskStatItem}>
                        <Ionicons name="cash" size={16} color="#FF9500" />
                        <Text style={styles.taskStatText}>
                          {formatCoins(task.rewardPerUser)} per user
                        </Text>
                      </View>
                      <View style={styles.taskStatItem}>
                        <Ionicons name="people" size={16} color="#5856D6" />
                        <Text style={styles.taskStatText}>
                          {task.completions} / {task.maxUsers}
                        </Text>
                      </View>
                      <View style={styles.taskStatItem}>
                        <Ionicons name="wallet" size={16} color="#34C759" />
                        <Text style={styles.taskStatText}>
                          {formatCoins(task.coinsUsed)} / {formatCoins(task.totalBudget)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `No tasks found matching "${searchQuery}"`
                  : taskFilter === 'all'
                    ? 'No tasks created yet'
                    : taskFilter === 'active'
                      ? 'No active tasks'
                      : 'No inactive tasks'}
              </Text>
              {taskFilter === 'all' && !searchQuery && (
                <TouchableOpacity
                  onPress={() => navigation.navigate(ROUTES.CREATOR_CREATE_TASK)}
                  style={styles.createFirstTaskButton}
                >
                  <Text style={styles.createFirstTaskText}>Create Your First Task</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                onPress={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? '#C7C7CC' : '#007AFF'} />
                <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>

              <View style={styles.pageNumbers}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <TouchableOpacity
                      key={pageNum}
                      style={[
                        styles.pageNumberButton,
                        currentPage === pageNum && styles.pageNumberButtonActive,
                      ]}
                      onPress={() => handlePageChange(pageNum)}
                    >
                      <Text
                        style={[
                          styles.pageNumberText,
                          currentPage === pageNum && styles.pageNumberTextActive,
                        ]}
                      >
                        {pageNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                onPress={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <Text style={[styles.paginationButtonText, currentPage === totalPages && styles.paginationButtonTextDisabled]}>
                  Next
                </Text>
                <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? '#C7C7CC' : '#007AFF'} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recent Completions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Completions</Text>
          {dashboard.recentCompletions.length > 0 ? (
            dashboard.recentCompletions.map((completion, index) => (
              <View key={index} style={styles.completionCard}>
                <View style={styles.completionHeader}>
                  <Text style={styles.completionUserName}>{completion.userName}</Text>
                  <Text style={styles.completionUsername}>@{completion.userUsername}</Text>
                </View>
                <Text style={styles.completionTask}>{completion.taskTitle}</Text>
                <Text style={styles.completionDate}>
                  {new Date(completion.completedAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="list-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>No completions yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Add Task Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate(ROUTES.CREATOR_CREATE_TASK)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for floating button
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
  },
  headerButton: {
    marginTop: 20,
    padding: 4,
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    marginTop: 20,
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletInfo: {
    flex: 1,
    marginLeft: 16,
  },
  walletLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  walletAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  walletValue: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
  },
  addCoinsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addCoinsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 6,
  },
  emptyWalletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  emptyWalletText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
    flex: 1,
  },
  linksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#000000',
    marginLeft: 12,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
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
    alignItems: 'center',
    marginBottom: 8,
  },
  completionUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  completionUsername: {
    fontSize: 14,
    color: '#8E8E93',
  },
  completionTask: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  completionDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
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
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addTaskText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskThumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: '#F2F2F7',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    padding: 16,
    paddingTop: 16,
  },
  taskHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
    marginTop: 20,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  taskBadgeActive: {
    backgroundColor: '#E8F5E9',
  },
  taskBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  taskBadgeTextActive: {
    color: '#34C759',
  },
  taskType: {
    fontSize: 12,
    color: '#8E8E93',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
  },
  taskDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  taskStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  taskStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskStatText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '500',
  },
  createFirstTaskButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  createFirstTaskText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  resultsInfo: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F9F9F9',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginHorizontal: 4,
  },
  paginationButtonTextDisabled: {
    color: '#C7C7CC',
  },
  pageNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageNumberButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberButtonActive: {
    backgroundColor: '#007AFF',
  },
  pageNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  pageNumberTextActive: {
    color: '#FFFFFF',
  },
});

export default CreatorDashboardScreen;

