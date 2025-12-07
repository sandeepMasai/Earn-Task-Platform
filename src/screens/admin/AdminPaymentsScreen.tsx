import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { adminService, Withdrawal } from '@services/adminService';
import { formatCoins, formatDate } from '@utils/validation';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
// Note: File download functionality requires expo-file-system and expo-sharing
// For now, we'll show an alert. Install these packages if needed:
// npm install expo-file-system expo-sharing

const AdminPaymentsScreen: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<'pending' | 'approved' | 'rejected' | 'completed'>(
    'pending'
  );
  const [rejectionReason, setRejectionReason] = useState('');

  const loadPayments = async () => {
    try {
      const data = await adminService.getAllPayments({
        status: selectedStatus || undefined,
        limit: 50,
      });
      setWithdrawals(data.withdrawals);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payments');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [selectedStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  const handleStatusChange = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setNewStatus(withdrawal.status);
    setRejectionReason('');
    setShowStatusModal(true);
  };

  const updateStatus = async () => {
    if (!selectedWithdrawal) return;

    if (!selectedWithdrawal.id) {
      Alert.alert('Error', 'Invalid withdrawal ID');
      return;
    }

    try {
      await adminService.updatePaymentStatus(
        selectedWithdrawal.id,
        newStatus,
        rejectionReason || undefined
      );
      setShowStatusModal(false);
      setSelectedWithdrawal(null);
      Alert.alert('Success', 'Payment status updated successfully');
      loadPayments();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  const downloadPayments = async () => {
    Alert.alert(
      'Download Payments',
      'To enable file download, please install:\n\nnpm install expo-file-system expo-sharing\n\nFor now, you can view payments in the app.',
      [{ text: 'OK' }]
    );
    // TODO: Implement file download when expo-file-system and expo-sharing are installed
    // try {
    //   const blob = await adminService.downloadPayments({
    //     status: selectedStatus || undefined,
    //   });
    //   // Implementation here
    // } catch (error: any) {
    //   Alert.alert('Error', error.message || 'Failed to download payments');
    // }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      case 'pending':
        return '#FF9500';
      default:
        return '#8E8E93';
    }
  };

  if (isLoading && withdrawals.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterButton, selectedStatus === '' && styles.filterButtonActive]}
            onPress={() => setSelectedStatus('')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedStatus === '' && styles.filterButtonTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedStatus === 'pending' && styles.filterButtonActive]}
            onPress={() => setSelectedStatus('pending')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedStatus === 'pending' && styles.filterButtonTextActive,
              ]}
            >
              Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedStatus === 'approved' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedStatus('approved')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedStatus === 'approved' && styles.filterButtonTextActive,
              ]}
            >
              Approved
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedStatus === 'rejected' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedStatus('rejected')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedStatus === 'rejected' && styles.filterButtonTextActive,
              ]}
            >
              Rejected
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedStatus === 'completed' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedStatus('completed')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedStatus === 'completed' && styles.filterButtonTextActive,
              ]}
            >
              Completed
            </Text>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity style={styles.downloadButton} onPress={downloadPayments}>
          <Ionicons name="download-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {withdrawals.length > 0 ? (
          withdrawals.map((withdrawal) => (
            <View key={withdrawal.id} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <View>
                  <Text style={styles.userName}>{withdrawal.user.name}</Text>
                  <Text style={styles.userEmail}>{withdrawal.user.email}</Text>
                  <Text style={styles.userUsername}>@{withdrawal.user.username}</Text>
                </View>
                <View
                  style={[styles.statusBadge, { backgroundColor: getStatusColor(withdrawal.status) + '20' }]}
                >
                  <Text style={[styles.statusText, { color: getStatusColor(withdrawal.status) }]}>
                    {withdrawal.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.paymentDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={styles.detailValue}>{formatCoins(withdrawal.amount)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method:</Text>
                  <Text style={styles.detailValue}>{withdrawal.paymentMethod}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Details:</Text>
                  <Text style={styles.detailValue}>{withdrawal.accountDetails}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Requested:</Text>
                  <Text style={styles.detailValue}>{formatDate(withdrawal.createdAt)}</Text>
                </View>
                {withdrawal.processedAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Processed:</Text>
                    <Text style={styles.detailValue}>{formatDate(withdrawal.processedAt)}</Text>
                  </View>
                )}
                {withdrawal.rejectionReason && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rejection Reason:</Text>
                    <Text style={[styles.detailValue, styles.rejectionReason]}>
                      {withdrawal.rejectionReason}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleStatusChange(withdrawal)}
              >
                <Ionicons name="create-outline" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>Update Status</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color="#8E8E93" />
            <Text style={styles.emptyText}>No payments found</Text>
          </View>
        )}
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Payment Status</Text>

            <View style={styles.statusOptions}>
              {(['pending', 'approved', 'rejected', 'completed'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    newStatus === status && styles.statusOptionActive,
                  ]}
                  onPress={() => setNewStatus(status)}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      newStatus === status && styles.statusOptionTextActive,
                    ]}
                  >
                    {status.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newStatus === 'rejected' && (
              <View style={styles.rejectionInput}>
                <Text style={styles.inputLabel}>Rejection Reason (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="Enter rejection reason..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowStatusModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.updateButton]}
                onPress={updateStatus}
              >
                <Text style={styles.updateButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  downloadButton: {
    padding: 8,
    marginLeft: 10,
  },
  scrollView: {
    flex: 1,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
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
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  detailValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  rejectionReason: {
    color: '#FF3B30',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF20',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statusOption: {
    flex: 1,
    minWidth: '45%',
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  statusOptionActive: {
    backgroundColor: '#007AFF',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
  },
  rejectionInput: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontWeight: '600',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default AdminPaymentsScreen;

