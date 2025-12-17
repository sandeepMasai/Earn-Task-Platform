import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminService, AdminUser } from '@services/adminService';
import { formatCoins, formatDate } from '@utils/validation';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';

const AdminUsersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);

  const loadUsers = async () => {
    try {
      const data = await adminService.getAllUsers({
        isActive: filterActive,
        search: searchQuery || undefined,
        limit: 50,
      });
      setUsers(data.users);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [filterActive]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery !== undefined) {
        loadUsers();
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleBlockUser = async (user: AdminUser) => {
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
              if (!user.id) {
                Alert.alert('Error', 'Invalid user ID');
                return;
              }
              await adminService.blockUser(user.id, !user.isActive);
              Alert.alert('Success', `User ${user.isActive ? 'blocked' : 'unblocked'} successfully`);
              loadUsers();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to update user');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = async (user: AdminUser) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user.id) {
                Alert.alert('Error', 'Invalid user ID');
                return;
              }
              await adminService.deleteUser(user.id);
              Alert.alert('Success', 'User deleted successfully');
              loadUsers();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  if (isLoading && users.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Search and Filter Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8E8E93"
          />
        </View>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, filterActive === undefined && styles.filterButtonActive]}
          onPress={() => setFilterActive(undefined)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterActive === undefined && styles.filterButtonTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterActive === true && styles.filterButtonActive]}
          onPress={() => setFilterActive(true)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterActive === true && styles.filterButtonTextActive,
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterActive === false && styles.filterButtonActive]}
          onPress={() => setFilterActive(false)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterActive === false && styles.filterButtonTextActive,
            ]}
          >
            Blocked
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {users.length > 0 ? (
          users.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              onPress={() => navigation.navigate(ROUTES.ADMIN_USER_DETAILS, { userId: user.id })}
            >
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
                    style={[
                      styles.statusText,
                      { color: user.isActive ? '#34C759' : '#FF3B30' },
                    ]}
                  >
                    {user.isActive ? 'ACTIVE' : 'BLOCKED'}
                  </Text>
                </View>
              </View>

              <View style={styles.userStats}>
                <View style={styles.statItem}>
                  <Ionicons name="cash-outline" size={16} color="#8E8E93" />
                  <Text style={styles.statValue}>{formatCoins(user.coins)}</Text>
                  <Text style={styles.statLabel}>Coins</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="trending-up-outline" size={16} color="#8E8E93" />
                  <Text style={styles.statValue}>{formatCoins(user.totalEarned)}</Text>
                  <Text style={styles.statLabel}>Earned</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="trending-down-outline" size={16} color="#8E8E93" />
                  <Text style={styles.statValue}>{formatCoins(user.totalWithdrawn)}</Text>
                  <Text style={styles.statLabel}>Withdrawn</Text>
                </View>
              </View>

              <View style={styles.userFooter}>
                <Text style={styles.userDate}>Joined: {formatDate(user.createdAt)}</Text>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.blockButton,
                      { backgroundColor: user.isActive ? '#FF3B3020' : '#34C75920' },
                    ]}
                    onPress={() => handleBlockUser(user)}
                  >
                    <Ionicons
                      name={user.isActive ? 'ban-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={user.isActive ? '#FF3B30' : '#34C759'}
                    />
                    <Text
                      style={[
                        styles.blockButtonText,
                        { color: user.isActive ? '#FF3B30' : '#34C759' },
                      ]}
                    >
                      {user.isActive ? 'Block' : 'Unblock'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteUser(user)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#8E8E93" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
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
  scrollView: {
    flex: 1,
  },
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  userInfo: {
    flex: 1,
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
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  userFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  blockButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FF3B3020',
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
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
});

export default AdminUsersScreen;

