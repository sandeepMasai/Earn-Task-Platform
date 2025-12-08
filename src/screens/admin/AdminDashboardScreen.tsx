import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminService, DashboardStats } from '@services/adminService';
import { formatCoins, formatCurrency } from '@utils/validation';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';

const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (isLoading && !stats) {
    return <LoadingSpinner fullScreen />;
  }

  const StatCard = ({ icon, label, value, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate(ROUTES.ADMIN_PAYMENTS)}
          >
            <Ionicons name="card-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate(ROUTES.ADMIN_USERS)}
          >
            <Ionicons name="people-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate(ROUTES.ADMIN_COIN_MANAGEMENT)}
          >
            <Ionicons name="cash-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate(ROUTES.ADMIN_TASKS)}
          >
            <Ionicons name="list-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {stats && (
        <>
          {/* User Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Users</Text>
            <View style={styles.statsRow}>
              <StatCard
                icon="people"
                label="Total Users"
                value={stats.stats.users.total}
                color="#007AFF"
              />
              <StatCard
                icon="checkmark-circle"
                label="Active"
                value={stats.stats.users.active}
                color="#34C759"
              />
              <StatCard
                icon="close-circle"
                label="Blocked"
                value={stats.stats.users.blocked}
                color="#FF3B30"
              />
            </View>
          </View>

          {/* Withdrawal Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Withdrawals</Text>
            <View style={styles.statsRow}>
              <StatCard
                icon="cash"
                label="Total"
                value={stats.stats.withdrawals.total}
                color="#007AFF"
              />
              <StatCard
                icon="time"
                label="Pending"
                value={stats.stats.withdrawals.pending}
                color="#FF9500"
              />
              <StatCard
                icon="checkmark-done"
                label="Approved"
                value={stats.stats.withdrawals.approved}
                color="#34C759"
              />
            </View>
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Total Withdrawal Amount</Text>
              <Text style={styles.amountValue}>
                {formatCoins(stats.stats.withdrawals.totalAmount)}
              </Text>
              <Text style={styles.amountRupees}>
                ≈ {formatCurrency(stats.stats.withdrawals.totalAmount / 100)}
              </Text>
            </View>
          </View>

          {/* Task Management */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Task Management</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.ADMIN_TASKS)}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color="#007AFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.taskManagementCard}
              onPress={() => navigation.navigate(ROUTES.ADMIN_TASKS)}
              activeOpacity={0.7}
            >
              <View style={styles.taskManagementContent}>
                <View style={styles.taskManagementIcon}>
                  <Ionicons name="list" size={32} color="#007AFF" />
                </View>
                <View style={styles.taskManagementInfo}>
                  <Text style={styles.taskManagementTitle}>Manage Tasks</Text>
                  <Text style={styles.taskManagementSubtitle}>
                    {stats.stats.tasks} total tasks
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#8E8E93" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.taskManagementCard}
              onPress={() => navigation.navigate(ROUTES.ADMIN_TASK_SUBMISSIONS)}
              activeOpacity={0.7}
            >
              <View style={styles.taskManagementContent}>
                <View style={styles.taskManagementIcon}>
                  <Ionicons name="document-text" size={32} color="#FF9500" />
                </View>
                <View style={styles.taskManagementInfo}>
                  <Text style={styles.taskManagementTitle}>Review Submissions</Text>
                  <Text style={styles.taskManagementSubtitle}>
                    Approve or reject task proofs
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#8E8E93" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Other Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Platform Stats</Text>
            <View style={styles.statsRow}>
              <StatCard
                icon="swap-horizontal"
                label="Transactions"
                value={stats.stats.transactions}
                color="#5856D6"
              />
              <StatCard
                icon="list"
                label="Tasks"
                value={stats.stats.tasks}
                color="#AF52DE"
              />
              <StatCard
                icon="images"
                label="Posts"
                value={stats.stats.posts}
                color="#FF2D55"
              />
            </View>
          </View>

          {/* Recent Withdrawals */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Withdrawals</Text>
              <TouchableOpacity onPress={() => navigation.navigate(ROUTES.ADMIN_PAYMENTS)}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {stats.recentWithdrawals.length > 0 ? (
              stats.recentWithdrawals.map((withdrawal) => (
                <View key={withdrawal.id} style={styles.recentItem}>
                  <View style={styles.recentItemLeft}>
                    <Text style={styles.recentItemName}>{withdrawal.user.name}</Text>
                    <Text style={styles.recentItemEmail}>{withdrawal.user.email}</Text>
                  </View>
                  <View style={styles.recentItemRight}>
                    <Text style={styles.recentItemAmount}>{formatCoins(withdrawal.amount)}</Text>
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
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent withdrawals</Text>
            )}
          </View>

          {/* Recent Users */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Users</Text>
              <TouchableOpacity onPress={() => navigation.navigate(ROUTES.ADMIN_USERS)}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {stats.recentUsers.length > 0 ? (
              stats.recentUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.recentItem}
                  onPress={() =>
                    navigation.navigate(ROUTES.ADMIN_USER_DETAILS, { userId: user.id })
                  }
                >
                  <View style={styles.recentItemLeft}>
                    <Text style={styles.recentItemName}>{user.name}</Text>
                    <Text style={styles.recentItemEmail}>{user.email}</Text>
                  </View>
                  <View style={styles.recentItemRight}>
                    <Text style={styles.recentItemAmount}>{formatCoins(user.coins)}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: user.isActive ? '#34C75920' : '#FF3B3020' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: user.isActive ? '#34C759' : '#FF3B30' },
                        ]}
                      >
                        {user.isActive ? 'ACTIVE' : 'BLOCKED'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent users</Text>
            )}
          </View>
        </>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    padding: 8,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
  },
  viewAll: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  taskManagementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskManagementContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskManagementIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  taskManagementInfo: {
    flex: 1,
  },
  taskManagementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  taskManagementSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
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
  amountCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  amountLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  amountRupees: {
    fontSize: 16,
    color: '#8E8E93',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  recentItemLeft: {
    flex: 1,
  },
  recentItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  recentItemEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  recentItemRight: {
    alignItems: 'flex-end',
  },
  recentItemAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    padding: 20,
  },
});

export default AdminDashboardScreen;

