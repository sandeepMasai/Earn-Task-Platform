import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { logoutUser, refreshUser } from '@store/slices/authSlice';
import { formatCoins } from '@utils/validation';
import { ROUTES } from '@constants';
import { Ionicons } from '@expo/vector-icons';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh user data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshUser());
    }, [dispatch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(refreshUser());
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await dispatch(logoutUser());
            navigation.reset({
              index: 0,
              routes: [{ name: ROUTES.LOGIN }],
            });
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'Edit Profile',
      onPress: () => console.log('Edit Profile'),
    },
    {
      icon: 'cash-outline',
      title: 'Earning History',
      onPress: () => navigation.navigate(ROUTES.EARNING_HISTORY),
    },
    {
      icon: 'receipt-outline',
      title: 'Withdrawal History',
      onPress: () => navigation.navigate(ROUTES.WITHDRAWAL_HISTORY),
    },
    {
      icon: 'people-outline',
      title: 'Referrals',
      onPress: () => navigation.navigate(ROUTES.REFERRALS),
    },
    ...(user?.role === 'admin'
      ? [
          {
            icon: 'shield-outline',
            title: 'Admin Dashboard',
            onPress: () => navigation.navigate(ROUTES.ADMIN_DASHBOARD),
            color: '#007AFF',
          },
        ]
      : []),
    {
      icon: 'settings-outline',
      title: 'Settings',
      onPress: () => console.log('Settings'),
    },
    {
      icon: 'help-circle-outline',
      title: 'Help & Support',
      onPress: () => console.log('Help & Support'),
    },
    {
      icon: 'log-out-outline',
      title: 'Logout',
      onPress: handleLogout,
      color: '#FF3B30',
    },
  ];

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#8E8E93" />
          </View>
        </View>
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <Text style={styles.username}>@{user?.username || 'username'}</Text>
        {user?.email && <Text style={styles.email}>{user.email}</Text>}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCoins(user?.coins || 0)}</Text>
          <Text style={styles.statLabel}>Current Balance</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCoins(user?.totalEarned || 0)}</Text>
          <Text style={styles.statLabel}>Total Earned</Text>
        </View>
      </View>

      {(user?.followersCount !== undefined || user?.followingCount !== undefined) && (
        <View style={styles.followStatsContainer}>
          <View style={styles.followStatCard}>
            <Text style={styles.followStatValue}>{user?.followersCount || 0}</Text>
            <Text style={styles.followStatLabel}>Followers</Text>
          </View>
          <View style={styles.followStatCard}>
            <Text style={styles.followStatValue}>{user?.followingCount || 0}</Text>
            <Text style={styles.followStatLabel}>Following</Text>
          </View>
        </View>
      )}

      {user?.referralCode && (
        <View style={styles.referralCard}>
          <View style={styles.referralHeader}>
            <Ionicons name="gift-outline" size={24} color="#007AFF" />
            <Text style={styles.referralTitle}>Your Referral Code</Text>
          </View>
          <Text style={styles.referralCode}>{user.referralCode}</Text>
          <Text style={styles.referralText}>
            Share this code with friends and earn {formatCoins(500)} coins for each referral!
          </Text>
        </View>
      )}

      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.icon as any}
              size={24}
              color={item.color || '#000000'}
            />
            <Text style={[styles.menuText, item.color ? { color: item.color } : null]}>
              {item.title}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        ))}
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
    paddingBottom: 20,
  },
  header: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  followStatsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  followStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  followStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  followStatLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  referralCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
    letterSpacing: 2,
  },
  referralText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 18,
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    marginLeft: 12,
  },
});

export default ProfileScreen;

