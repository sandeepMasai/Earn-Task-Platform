import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchBalance, fetchTransactions } from '@store/slices/walletSlice';
import { refreshUser } from '@store/slices/authSlice';
import { formatCoins, formatCurrency, formatDate } from '@utils/validation';
import { coinsToRupees } from '@utils/validation';
import { ROUTES, MIN_WITHDRAWAL_AMOUNT } from '@constants';
import Button from '@components/common/Button';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';

const WalletScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { balance, totalEarned, totalWithdrawn, transactions, isLoading } = useAppSelector(
    (state) => state.wallet
  );
  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = () => {
    dispatch(fetchBalance());
    dispatch(fetchTransactions());
    dispatch(refreshUser());
  };

  useEffect(() => {
    loadData();
  }, [dispatch]);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchBalance()),
      dispatch(fetchTransactions()),
      dispatch(refreshUser()),
    ]);
    setRefreshing(false);
  };

  const canWithdraw = balance >= MIN_WITHDRAWAL_AMOUNT;
  const rupeesValue = coinsToRupees(balance);

  const renderTransaction = ({ item }: { item: any }) => {
    const isEarned = item.type === 'earned';
    return (
      <View style={styles.transactionItem}>
        <View
          style={[
            styles.transactionIcon,
            { backgroundColor: isEarned ? '#34C75920' : '#FF3B3020' },
          ]}
        >
          <Ionicons
            name={isEarned ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={24}
            color={isEarned ? '#34C759' : '#FF3B30'}
          />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription}>{item.description}</Text>
          <Text style={styles.transactionDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text
          style={[
            styles.transactionAmount,
            { color: isEarned ? '#34C759' : '#FF3B30' },
          ]}
        >
          {isEarned ? '+' : '-'}
          {formatCoins(item.amount)}
        </Text>
      </View>
    );
  };

  if (isLoading && balance === 0) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Balance</Text>
        <Text style={styles.balanceAmount}>{formatCoins(balance)}</Text>
        <Text style={styles.rupeesValue}>≈ {formatCurrency(rupeesValue)}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#34C759" />
          <Text style={styles.statValue}>{formatCoins(totalEarned)}</Text>
          <Text style={styles.statLabel}>Total Earned</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trending-down" size={24} color="#FF3B30" />
          <Text style={styles.statValue}>{formatCoins(totalWithdrawn)}</Text>
          <Text style={styles.statLabel}>Total Withdrawn</Text>
        </View>
      </View>

      <Button
        title={
          canWithdraw
            ? `Withdraw (Min: ${formatCoins(MIN_WITHDRAWAL_AMOUNT)})`
            : `Need ${formatCoins(MIN_WITHDRAWAL_AMOUNT - balance)} more to withdraw`
        }
        onPress={() => navigation.navigate(ROUTES.WITHDRAW)}
        disabled={!canWithdraw}
        style={styles.withdrawButton}
      />

      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length > 0 ? (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransaction}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#8E8E93" />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  rupeesValue: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  withdrawButton: {
    marginBottom: 24,
  },
  transactionsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    marginTop: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 12,
  },
});

export default WalletScreen;

