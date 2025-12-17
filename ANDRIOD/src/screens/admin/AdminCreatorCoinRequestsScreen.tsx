import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminService } from '@services/adminService';
import { formatCoins, formatCurrency } from '@utils/validation';
import { API_BASE_URL } from '@constants';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

interface CreatorCoinRequest {
  id: string;
  creator: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
  coins: number;
  amount: number;
  paymentProof: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  reviewedBy?: {
    id: string;
    name: string;
    username: string;
  } | null;
  reviewedAt?: string | null;
  requestedAt: string;
}

const UPI_ID = 'sk245444@ybl';

const AdminCreatorCoinRequestsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<CreatorCoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await adminService.getCreatorCoinRequests(status);
      setRequests(data);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load coin requests',
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

  const handleApprove = (requestId: string, creatorName: string, coins: number) => {
    Alert.alert(
      'Approve Coin Request',
      `Approve ${formatCoins(coins)} coins (₹${(coins / 100).toFixed(2)}) for ${creatorName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const result = await adminService.approveCreatorCoinRequest(requestId);
              Toast.show({
                type: 'success',
                text1: 'Approved Successfully!',
                text2: `${formatCoins(coins)} coins automatically added to ${creatorName}'s creator wallet. New balance: ${formatCoins(result.creatorWallet || coins)}`,
                visibilityTime: 4000,
              });
              loadRequests();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to approve coin request',
              });
            }
          },
        },
      ]
    );
  };

  const handleReject = (requestId: string, creatorName: string) => {
    Alert.prompt(
      'Reject Coin Request',
      `Enter reason for rejecting ${creatorName}'s coin request:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason?: string) => {
            try {
              await adminService.rejectCreatorCoinRequest(requestId, reason || 'Payment proof verification failed');
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Coin request rejected',
              });
              loadRequests();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to reject coin request',
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      default:
        return 'time';
    }
  };

  const getProofImageUrl = (path: string) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;

    // Handle absolute file paths (like /Users/.../uploads/filename.jpg)
    if (path.includes('/uploads/')) {
      const fileName = path.split('/uploads/')[1];
      return `${API_BASE_URL.replace('/api', '')}/uploads/${fileName}`;
    }

    // Handle relative paths
    if (path.startsWith('/')) {
      return `${API_BASE_URL.replace('/api', '')}${path}`;
    }

    // Default: assume it's in uploads folder
    return `${API_BASE_URL.replace('/api', '')}/uploads/${path}`;
  };

  const renderRequest = ({ item }: { item: CreatorCoinRequest }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const proofUrl = getProofImageUrl(item.paymentProof);

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorName}>{item.creator.name}</Text>
            <Text style={styles.creatorEmail}>{item.creator.email}</Text>
            <Text style={styles.creatorUsername}>@{item.creator.username}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name={statusIcon} size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.coinInfo}>
          <View style={styles.coinRow}>
            <Text style={styles.coinLabel}>Coins Requested:</Text>
            <Text style={styles.coinValue}>{formatCoins(item.coins)}</Text>
          </View>
          <View style={styles.coinRow}>
            <Text style={styles.coinLabel}>Amount:</Text>
            <Text style={styles.amountValue}>₹{item.amount}</Text>
          </View>
        </View>

        {/* UPI ID Display */}
        <View style={styles.upiCard}>
          <Text style={styles.upiLabel}>Payment UPI ID:</Text>
          <View style={styles.upiRow}>
            <Ionicons name="wallet-outline" size={16} color="#007AFF" />
            <Text style={styles.upiValue}>{UPI_ID}</Text>
          </View>
        </View>

        {proofUrl && (
          <View style={styles.proofSection}>
            <Text style={styles.proofLabel}>Payment Proof:</Text>
            {proofUrl.toLowerCase().endsWith('.pdf') ? (
              <TouchableOpacity
                style={styles.pdfContainer}
                onPress={() => {
                  Linking.openURL(proofUrl).catch((err) => {
                    Toast.show({
                      type: 'error',
                      text1: 'Error',
                      text2: 'Could not open PDF file',
                    });
                  });
                }}
              >
                <Ionicons name="document-text" size={48} color="#007AFF" />
                <Text style={styles.pdfText}>View PDF</Text>
                <Text style={styles.pdfHint}>Tap to open payment proof PDF</Text>
              </TouchableOpacity>
            ) : (
              <Image
                source={{ uri: proofUrl }}
                style={styles.proofImage}
                resizeMode="contain"
                onError={(error) => {
                  console.log('Image load error:', error);
                  Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Could not load payment proof image',
                  });
                }}
              />
            )}
          </View>
        )}

        {item.status === 'rejected' && item.rejectionReason && (
          <View style={styles.rejectionCard}>
            <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
            <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
          </View>
        )}

        <View style={styles.historySection}>
          <Text style={styles.historyLabel}>Request History</Text>
          <View style={styles.historyRow}>
            <Text style={styles.historyKey}>Requested by:</Text>
            <Text style={styles.historyValue}>
              {item.creator.name} (@{item.creator.username})
            </Text>
          </View>
          <View style={styles.historyRow}>
            <Text style={styles.historyKey}>User ID:</Text>
            <Text style={styles.historyValue}>{item.creator.id}</Text>
          </View>
          <View style={styles.historyRow}>
            <Text style={styles.historyKey}>Requested on:</Text>
            <Text style={styles.historyValue}>
              {new Date(item.requestedAt).toLocaleString()}
            </Text>
          </View>
          {item.reviewedBy && (
            <>
              <View style={styles.historyRow}>
                <Text style={styles.historyKey}>Reviewed by:</Text>
                <Text style={styles.historyValue}>
                  {item.reviewedBy.name} (@{item.reviewedBy.username})
                </Text>
              </View>
              {item.reviewedAt && (
                <View style={styles.historyRow}>
                  <Text style={styles.historyKey}>
                    {item.status === 'approved' ? 'Approved on:' : 'Rejected on:'}
                  </Text>
                  <Text style={styles.historyValue}>
                    {new Date(item.reviewedAt).toLocaleString()}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {item.status === 'pending' ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(item.id, item.creator.name, item.coins)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item.id, item.creator.name)}
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
            {item.status === 'approved' && (
              <Text style={styles.statusSubText}>
                Coins added to {item.creator.name}'s wallet
              </Text>
            )}
            {item.status === 'rejected' && item.rejectionReason && (
              <Text style={styles.statusSubText}>
                Reason: {item.rejectionReason}
              </Text>
            )}
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
        <Text style={styles.title}>Creator Coin Requests</Text>
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
            <Ionicons name="wallet-outline" size={48} color="#8E8E93" />
            <Text style={styles.emptyText}>No coin requests found</Text>
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
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  creatorEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  creatorUsername: {
    fontSize: 14,
    color: '#007AFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  coinInfo: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  coinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  coinLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  coinValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34C759',
  },
  upiCard: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  upiLabel: {
    fontSize: 12,
    color: '#1976D2',
    marginBottom: 8,
    fontWeight: '600',
  },
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upiValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginLeft: 8,
  },
  proofSection: {
    marginBottom: 12,
  },
  proofLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  proofImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  pdfContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  pdfText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 8,
  },
  pdfHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  rejectionCard: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    color: '#000000',
  },
  reviewInfo: {
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  reviewDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  requestDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 12,
  },
  historySection: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  historyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyKey: {
    fontSize: 12,
    color: '#8E8E93',
    flex: 1,
  },
  historyValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
    textAlign: 'right',
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
    marginBottom: 4,
  },
  statusSubText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
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

export default AdminCreatorCoinRequestsScreen;

