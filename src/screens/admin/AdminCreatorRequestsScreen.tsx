import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminService } from '@services/adminService';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

interface CreatorRequest {
  id: string;
  name: string;
  username: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  youtubeUrl?: string | null;
  instagramUrl?: string | null;
  approvedBy?: {
    id: string;
    name: string;
    username: string;
  } | null;
  approvedAt?: string | null;
  requestedAt: string;
}

const AdminCreatorRequestsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<CreatorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    try {
      // If 'all' is selected, don't pass status filter to get all requests
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await adminService.getCreatorRequests(status);
      setRequests(data);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load creator requests',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const handleApprove = (requestId: string, userName: string) => {
    Alert.alert(
      'Approve Creator',
      `Are you sure you want to approve ${userName} as a creator?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await adminService.approveCreator(requestId);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Creator approved successfully',
              });
              loadRequests();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to approve creator',
              });
            }
          },
        },
      ]
    );
  };

  const handleReject = (requestId: string, userName: string) => {
    Alert.prompt(
      'Reject Creator Request',
      `Enter reason for rejecting ${userName}'s creator request:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason) => {
            try {
              await adminService.rejectCreator(requestId, reason || 'Request rejected');
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Creator request rejected',
              });
              loadRequests();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to reject creator request',
              });
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      default:
        return '#FF9500';
    }
  };

  const renderRequest = ({ item }: { item: CreatorRequest }) => {
    const statusColor = getStatusColor(item.status);

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            <Text style={styles.userUsername}>@{item.username}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {(item.youtubeUrl || item.instagramUrl) && (
          <View style={styles.linksSection}>
            {item.youtubeUrl && (
              <View style={styles.linkItem}>
                <Ionicons name="logo-youtube" size={16} color="#FF0000" />
                <Text style={styles.linkText} numberOfLines={1}>
                  {item.youtubeUrl}
                </Text>
              </View>
            )}
            {item.instagramUrl && (
              <View style={styles.linkItem}>
                <Ionicons name="logo-instagram" size={16} color="#E4405F" />
                <Text style={styles.linkText} numberOfLines={1}>
                  {item.instagramUrl}
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.requestDate}>
          Requested: {new Date(item.requestedAt).toLocaleDateString()}
        </Text>

        {item.approvedAt && (
          <Text style={styles.approvedDate}>
            Approved: {new Date(item.approvedAt).toLocaleDateString()}
          </Text>
        )}

        {item.approvedBy && (
          <Text style={styles.approvedBy}>
            Approved by: {item.approvedBy.name} (@{item.approvedBy.username})
          </Text>
        )}

        {item.status === 'pending' ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(item.id, item.name)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item.id, item.name)}
            >
              <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.statusInfo}>
            <Text style={styles.statusInfoText}>
              {item.status === 'approved' 
                ? '✅ Approved' 
                : item.status === 'rejected'
                ? '❌ Rejected'
                : '⏳ Pending'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
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
        <Text style={styles.title}>Creator Requests</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            statusFilter === 'pending' && styles.filterButtonActive,
          ]}
          onPress={() => setStatusFilter('pending')}
        >
          <Text
            style={[
              styles.filterButtonText,
              statusFilter === 'pending' && styles.filterButtonTextActive,
            ]}
          >
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            statusFilter === 'approved' && styles.filterButtonActive,
          ]}
          onPress={() => setStatusFilter('approved')}
        >
          <Text
            style={[
              styles.filterButtonText,
              statusFilter === 'approved' && styles.filterButtonTextActive,
            ]}
          >
            Approved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            statusFilter === 'rejected' && styles.filterButtonActive,
          ]}
          onPress={() => setStatusFilter('rejected')}
        >
          <Text
            style={[
              styles.filterButtonText,
              statusFilter === 'rejected' && styles.filterButtonTextActive,
            ]}
          >
            Rejected
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            statusFilter === 'all' && styles.filterButtonActive,
          ]}
          onPress={() => setStatusFilter('all')}
        >
          <Text
            style={[
              styles.filterButtonText,
              statusFilter === 'all' && styles.filterButtonTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#8E8E93" />
            <Text style={styles.emptyText}>No creator requests found</Text>
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: '#007AFF',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  linksSection: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
    flex: 1,
  },
  requestDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  approvedDate: {
    fontSize: 12,
    color: '#34C759',
    marginBottom: 4,
    fontWeight: '500',
  },
  approvedBy: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusInfo: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  statusInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
});

export default AdminCreatorRequestsScreen;

