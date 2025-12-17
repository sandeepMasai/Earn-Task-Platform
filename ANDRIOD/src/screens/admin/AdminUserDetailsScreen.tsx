import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { adminService, AdminUser, Withdrawal } from '@services/adminService';
import { formatCoins, formatDate } from '@utils/validation';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';

const AdminUserDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userId } = route.params;

  const [user, setUser] = useState<AdminUser | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUserDetails = async () => {
    try {
      const data = await adminService.getUserDetails(userId);
      setUser(data.user);
      setWithdrawals(data.withdrawals);
      setTransactions(data.transactions);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load user details');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUserDetails();
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUserDetails();
  };

  const handleBlockUser = () => {
    if (!user) return;

    Alert.alert(
      user.isActive ? 'Block User' : 'Unblock User',
      `Are you sure you want to ${user.isActive ? 'block' : 'unblock'} ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user.isActive ? 'Block' : 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.blockUser(user.id, !user.isActive);
              Alert.alert('Success', `User ${user.isActive ? 'blocked' : 'unblocked'} successfully`);
              loadUserDetails();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to update user');
            }
          },
        },
      ]
    );
  };

  if (isLoading && !user) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* User Info Card */}
      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.userUsername}>@{user.username}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: user.isActive ? '#34C75920' : '#FF3B3020' },
            ]}
          >
            <Text
              style={[styles.statusText, { color: user.isActive ? '#34C759' : '#FF3B30' }]}
            >
              {user.isActive ? 'ACTIVE' : 'BLOCKED'}
            </Text>
          </View>
        </View>

        <View style={styles.userStats}>
          <View style={styles.statItem}>
            <Ionicons name="cash-outline" size={24} color="#007AFF" />
            <Text style={styles.statValue}>{formatCoins(user.coins)}</Text>
            <Text style={styles.statLabel}>Current Balance</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="trending-up-outline" size={24} color="#34C759" />
            <Text style={styles.statValue}>{formatCoins(user.totalEarned)}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="trending-down-outline" size={24} color="#FF3B30" />
            <Text style={styles.statValue}>{formatCoins(user.totalWithdrawn)}</Text>
            <Text style={styles.statLabel}>Total Withdrawn</Text>
          </View>
        </View>

        <View style={styles.userMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Referral Code:</Text>
            <Text style={styles.metaValue}>{user.referralCode}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Joined:</Text>
            <Text style={styles.metaValue}>{formatDate(user.createdAt)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.blockButton,
            { backgroundColor: user.isActive ? '#FF3B3020' : '#34C75920' },
          ]}
          onPress={handleBlockUser}
        >
          <Ionicons
            name={user.isActive ? 'ban-outline' : 'checkmark-circle-outline'}
            size={20}
            color={user.isActive ? '#FF3B30' : '#34C759'}
          />
          <Text
            style={[
              styles.blockButtonText,
              { color: user.isActive ? '#FF3B30' : '#34C759' },
            ]}
          >
            {user.isActive ? 'Block User' : 'Unblock User'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Withdrawals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Withdrawal Requests ({withdrawals.length})</Text>
        {withdrawals.length > 0 ? (
          withdrawals.map((withdrawal, idx) => (
            <View
              key={withdrawal.id || (withdrawal as any)._id || `withdrawal-${idx}`}
              style={styles.withdrawalCard}
            >
              <View style={styles.withdrawalHeader}>
                <Text style={styles.withdrawalAmount}>{formatCoins(withdrawal.amount)}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        withdrawal.status === 'approved'
                          ? '#34C75920'
                          : withdrawal.status === 'rejected'
                            ? '#FF3B3020'
                            : '#FF950020',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          withdrawal.status === 'approved'
                            ? '#34C759'
                            : withdrawal.status === 'rejected'
                              ? '#FF3B30'
                              : '#FF9500',
                      },
                    ]}
                  >
                    {withdrawal.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.withdrawalMethod}>{withdrawal.paymentMethod}</Text>
              <Text style={styles.withdrawalAccount}>{withdrawal.accountDetails}</Text>
              <Text style={styles.withdrawalDate}>{formatDate(withdrawal.createdAt)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No withdrawal requests</Text>
        )}
      </View>

      {/* Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions ({transactions.length})</Text>
        {transactions.length > 0 ? (
          transactions.slice(0, 20).map((transaction, idx) => (
            <View
              key={transaction.id || (transaction as any)._id || `tx-${idx}`}
              style={styles.transactionCard}
            >
              <View style={styles.transactionHeader}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <Text style={styles.transactionDate}>{formatDate(transaction.createdAt)}</Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    {
                      color:
                        transaction.type === 'earned' || transaction.type === 'referral'
                          ? '#34C759'
                          : '#FF3B30',
                    },
                  ]}
                >
                  {transaction.type === 'earned' || transaction.type === 'referral' ? '+' : '-'}
                  {formatCoins(transaction.amount)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No transactions</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 16,
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
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  userMeta: {
    marginBottom: 20,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  metaValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 8,
  },
  blockButtonText: {
    fontSize: 16,
    fontWeight: '600',

  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
    marginTop: 20,
  },
  withdrawalCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  withdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  withdrawalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  withdrawalMethod: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  withdrawalAccount: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  withdrawalDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    color: '#FF3B30',
    padding: 20,
    fontSize: 16,
  },
});

export default AdminUserDetailsScreen;

