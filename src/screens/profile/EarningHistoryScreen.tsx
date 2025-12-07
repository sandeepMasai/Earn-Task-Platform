import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { walletService } from '@services/walletService';
import { Transaction } from '@types';
import { formatCoins, formatDate } from '@utils/validation';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';

const EarningHistoryScreen: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = async () => {
    try {
      const data = await walletService.getTransactions();
      // Filter only earned transactions
      const earned = data.filter((t: any) => 
        t.type === 'earned' || t.type === 'referral' || t.type === 'bonus'
      );
      // Transform _id to id if needed
      const transformed = earned.map((t: any) => ({
        ...t,
        id: t._id || t.id,
      }));
      setTransactions(transformed);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'referral':
        return 'people';
      case 'bonus':
        return 'gift';
      default:
        return 'cash';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'referral':
        return '#007AFF';
      case 'bonus':
        return '#AF52DE';
      default:
        return '#34C759';
    }
  };

  if (isLoading && transactions.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  // Calculate total earned
  const totalEarned = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Earning History</Text>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Earned</Text>
          <Text style={styles.totalAmount}>{formatCoins(totalEarned)}</Text>
        </View>
      </View>

      {transactions.length > 0 ? (
        transactions.map((transaction) => (
          <View key={transaction.id} style={styles.transactionCard}>
            <View style={styles.transactionHeader}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: getTransactionColor(transaction.type) + '20' },
                ]}
              >
                <Ionicons
                  name={getTransactionIcon(transaction.type) as any}
                  size={24}
                  color={getTransactionColor(transaction.type)}
                />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDescription}>{transaction.description}</Text>
                <Text style={styles.transactionDate}>{formatDate(transaction.createdAt)}</Text>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  { color: getTransactionColor(transaction.type) },
                ]}
              >
                +{formatCoins(transaction.amount)}
              </Text>
            </View>
            {transaction.type === 'referral' && (
              <View style={styles.badgeContainer}>
                <View style={styles.badge}>
                  <Ionicons name="people-outline" size={12} color="#007AFF" />
                  <Text style={styles.badgeText}>Referral Bonus</Text>
                </View>
              </View>
            )}
          </View>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="cash-outline" size={64} color="#8E8E93" />
          <Text style={styles.emptyText}>No earning history</Text>
          <Text style={styles.emptySubtext}>
            Complete tasks to start earning coins
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
    marginBottom: 16,
  },
  totalContainer: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34C759',
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  badgeContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
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

export default EarningHistoryScreen;

