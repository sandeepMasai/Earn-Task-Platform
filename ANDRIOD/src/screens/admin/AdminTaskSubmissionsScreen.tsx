import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminService, TaskSubmission } from '@services/adminService';
import { formatCoins, formatDate } from '@utils/validation';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { API_BASE_URL } from '@constants';

const AdminTaskSubmissionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadSubmissions();
  }, [filter]);

  const loadSubmissions = async () => {
    try {
      const data = await adminService.getTaskSubmissions(filter);
      setSubmissions(data);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load submissions',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSubmissions();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const getProofImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return `${API_BASE_URL.replace('/api', '')}${imagePath}`;
  };

  const renderSubmissionCard = ({ item }: { item: TaskSubmission }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate(ROUTES.ADMIN_TASK_SUBMISSION_DETAILS, {
          submissionId: item.id,
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#007AFF" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.user.name}</Text>
            <Text style={styles.userEmail}>@{item.user.username}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Ionicons name={getStatusIcon(item.status) as any} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.taskInfo}>
        <Text style={styles.taskTitle}>{item.task.title}</Text>
        <Text style={styles.taskType}>
          {item.task.type === 'instagram_follow'
            ? 'Instagram Follow'
            : item.task.type === 'instagram_like'
              ? 'Instagram Like'
              : item.task.type === 'youtube_subscribe'
                ? 'YouTube Subscribe'
                : item.task.type}
        </Text>
      </View>

      <View style={styles.proofPreview}>
        <Image
          source={{ uri: getProofImageUrl(item.proofImage) }}
          style={styles.proofThumbnail}
        />
        <View style={styles.proofOverlay}>
          <Ionicons name="image" size={16} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="diamond-outline" size={16} color="#FF9500" />
          <Text style={styles.footerText}>{formatCoins(item.task.coins)}</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="time-outline" size={16} color="#8E8E93" />
          <Text style={styles.footerText}>{formatDate(item.submittedAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading && submissions.length === 0) {
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
        <Text style={styles.title}>Task Submissions</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'approved' && styles.filterButtonActive]}
          onPress={() => setFilter('approved')}
        >
          <Text style={[styles.filterText, filter === 'approved' && styles.filterTextActive]}>
            Approved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'rejected' && styles.filterButtonActive]}
          onPress={() => setFilter('rejected')}
        >
          <Text style={[styles.filterText, filter === 'rejected' && styles.filterTextActive]}>
            Rejected
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={submissions}
        renderItem={renderSubmissionCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#8E8E93" />
            <Text style={styles.emptyText}>No {filter} submissions found</Text>
          </View>
        }
      />
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
  placeholder: {
    width: 32,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F2F2F7',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  userEmail: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  taskInfo: {
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    marginTop: 20,
  },
  taskType: {
    fontSize: 12,
    color: '#8E8E93',
  },
  proofPreview: {
    position: 'relative',
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  proofThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
  },
  proofOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
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
});

export default AdminTaskSubmissionsScreen;

