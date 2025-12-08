import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Image, Linking, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { logoutUser, refreshUser } from '@store/slices/authSlice';
import { formatCoins } from '@utils/validation';
import { ROUTES, API_BASE_URL, SUPPORT_CHANNELS } from '@constants';
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

  const handleHelpSupport = () => {
    Alert.alert(
      'Help & Support',
      'Choose a support channel to get help:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Telegram',
          onPress: () => openTelegram(),
        },
        {
          text: 'WhatsApp',
          onPress: () => openWhatsApp(),
        },
      ],
      { cancelable: true }
    );
  };

  const openTelegram = async () => {
    try {
      const telegramUrl = SUPPORT_CHANNELS.TELEGRAM;
      const canOpen = await Linking.canOpenURL(telegramUrl);
      
      if (canOpen) {
        await Linking.openURL(telegramUrl);
      } else {
        // Try opening in browser if Telegram app is not installed
        const webUrl = telegramUrl.replace('t.me/', 'web.telegram.org/k/#@');
        await Linking.openURL(webUrl);
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        'Unable to open Telegram. Please make sure Telegram is installed or try again later.',
        [{ text: 'OK' }]
      );
    }
  };

  const openWhatsApp = async () => {
    try {
      const whatsappUrl = SUPPORT_CHANNELS.WHATSAPP;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert(
          'WhatsApp Not Found',
          'Please install WhatsApp to contact support.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        'Unable to open WhatsApp. Please make sure WhatsApp is installed or try again later.',
        [{ text: 'OK' }]
      );
    }
  };

  // Helper to get full avatar URL
  const getAvatarUrl = (avatar: string | null | undefined): string | null => {
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    if (avatar.startsWith('/uploads/')) {
      const baseUrl = API_BASE_URL.replace('/api', '');
      return `${baseUrl}${avatar}`;
    }
    return avatar;
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'Edit Profile',
      onPress: () => navigation.navigate(ROUTES.EDIT_PROFILE),
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
      onPress: handleHelpSupport,
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
          {user?.avatar ? (
            <Image 
              source={{ uri: getAvatarUrl(user.avatar) || '' }} 
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="#8E8E93" />
            </View>
          )}
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
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F2F2F7',
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

