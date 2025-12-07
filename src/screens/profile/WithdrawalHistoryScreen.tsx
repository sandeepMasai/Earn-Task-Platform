import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { walletService } from '@services/walletService';
import { WithdrawalRequest } from '@types';
import { formatCoins, formatDate } from '@utils/validation';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';

const WithdrawalHistoryScreen: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWithdrawals = async () => {
    try {
      const data = await walletService.getWithdrawalRequests();
      // Transform _id to id if needed
      const transformed = data.map((w: any) => ({
        ...w,
        id: w._id || w.id,
      }));
      setWithdrawals(transformed);
    } catch (error: any) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadWithdrawals();
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  if (isLoading && withdrawals.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Withdrawal History</Text>
        <Text style={styles.subtitle}>{withdrawals.length} withdrawal(s)</Text>
      </View>

      {withdrawals.length > 0 ? (
        withdrawals.map((withdrawal) => (
          <View key={withdrawal.id} style={styles.withdrawalCard}>
            <View style={styles.withdrawalHeader}>
              <View style={styles.amountContainer}>
                <Text style={styles.amount}>{formatCoins(withdrawal.amount)}</Text>
                <Text style={styles.date}>{formatDate(withdrawal.requestedAt)}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(withdrawal.status) + '20' },
                ]}
              >
                <Ionicons
                  name={getStatusIcon(withdrawal.status) as any}
                  size={16}
                  color={getStatusColor(withdrawal.status)}
                />
                <Text
                  style={[styles.statusText, { color: getStatusColor(withdrawal.status) }]}
                >
                  {withdrawal.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Ionicons name="card-outline" size={16} color="#8E8E93" />
                <Text style={styles.detailLabel}>Payment Method:</Text>
                <Text style={styles.detailValue}>{withdrawal.paymentMethod}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="wallet-outline" size={16} color="#8E8E93" />
                <Text style={styles.detailLabel}>Account:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {withdrawal.accountDetails}
                </Text>
              </View>
              {withdrawal.processedAt && (
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailLabel}>Processed:</Text>
                  <Text style={styles.detailValue}>{formatDate(withdrawal.processedAt)}</Text>
                </View>
              )}
              {withdrawal.rejectionReason && (
                <View style={styles.rejectionContainer}>
                  <Ionicons name="alert-circle-outline" size={16} color="#FF3B30" />
                  <Text style={styles.rejectionText}>{withdrawal.rejectionReason}</Text>
                </View>
              )}
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#8E8E93" />
          <Text style={styles.emptyText}>No withdrawal history</Text>
          <Text style={styles.emptySubtext}>
            Your withdrawal requests will appear here
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  withdrawalCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  withdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  amountContainer: {
    flex: 1,
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#8E8E93',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
    minWidth: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  rejectionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FF3B3020',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  rejectionText: {
    flex: 1,
    fontSize: 14,
    color: '#FF3B30',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
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
    textAlign: 'center',
  },
});

export default WithdrawalHistoryScreen;

