import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { referralService, ReferralStats } from '@services/referralService';
import { formatCoins, formatDate } from '@utils/validation';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';

const ReferralsScreen: React.FC = () => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const data = await referralService.getReferralStats();
      // Transform _id to id if needed
      const transformed = {
        ...data,
        referrals: data.referrals.map((r: any) => ({
          ...r,
          id: r._id || r.id,
        })),
      };
      setStats(transformed);
    } catch (error: any) {
      console.error('Error loading referral stats:', error);
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Referrals</Text>
      </View>

      {stats && (
        <>
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="people" size={32} color="#007AFF" />
              <Text style={styles.statValue}>{stats.referralCount}</Text>
              <Text style={styles.statLabel}>Total Referrals</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cash" size={32} color="#34C759" />
              <Text style={styles.statValue}>{formatCoins(stats.totalReferralEarnings)}</Text>
              <Text style={styles.statLabel}>Total Earnings</Text>
            </View>
          </View>

          {/* Referral Code */}
          <View style={styles.referralCodeCard}>
            <View style={styles.referralCodeHeader}>
              <Ionicons name="gift-outline" size={24} color="#007AFF" />
              <Text style={styles.referralCodeTitle}>Your Referral Code</Text>
            </View>
            <Text style={styles.referralCode}>{stats.referralCode}</Text>
            <Text style={styles.referralCodeText}>
              Share this code and earn {formatCoins(500)} coins for each referral!
            </Text>
          </View>

          {/* Referred Users List */}
          <View style={styles.referralsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Referred Users ({stats.referrals.length})
              </Text>
            </View>

            {stats.referrals.length > 0 ? (
              stats.referrals.map((referral) => (
                <View key={referral.id} style={styles.referralCard}>
                  <View style={styles.referralAvatar}>
                    <Ionicons name="person" size={24} color="#8E8E93" />
                  </View>
                  <View style={styles.referralInfo}>
                    <Text style={styles.referralName}>@{referral.username}</Text>
                    <Text style={styles.referralEmail}>{referral.email}</Text>
                    <Text style={styles.referralDate}>
                      Joined: {formatDate(referral.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.bonusBadge}>
                    <Ionicons name="cash-outline" size={16} color="#34C759" />
                    <Text style={styles.bonusText}>+{formatCoins(500)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color="#8E8E93" />
                <Text style={styles.emptyText}>No referrals yet</Text>
                <Text style={styles.emptySubtext}>
                  Share your referral code to start earning!
                </Text>
              </View>
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
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  referralCodeCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  referralCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralCodeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
    marginTop: 20,
  },
  referralCode: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
    letterSpacing: 2,
    textAlign: 'center',
  },
  referralCodeText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  referralsSection: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 20,
  },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  referralAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  referralInfo: {
    flex: 1,
  },
  referralName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  referralEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  referralDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C75920',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  bonusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
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

export default ReferralsScreen;

