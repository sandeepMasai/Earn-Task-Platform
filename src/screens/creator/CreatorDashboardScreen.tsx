import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { creatorService, CreatorDashboard } from '@services/creatorService';
import { formatCoins, formatTime } from '@utils/validation';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const CreatorDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Refresh dashboard when screen comes into focus (e.g., after coin request approval)
  useFocusEffect(
    React.useCallback(() => {
      loadDashboard();
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

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
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
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
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
});

export default CreatorDashboardScreen;

