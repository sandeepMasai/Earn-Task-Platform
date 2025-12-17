import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { creatorService } from '@services/creatorService';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

interface CreatorRequestHistory {
  isCreator: boolean;
  creatorStatus: 'pending' | 'approved' | 'rejected' | null;
  creatorApprovedBy?: {
    id: string;
    name: string;
    username: string;
  } | null;
  creatorApprovedAt?: string | null;
  creatorYouTubeUrl?: string | null;
  creatorInstagramUrl?: string | null;
  requestedAt?: string;
}

const CreatorRequestHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [history, setHistory] = useState<CreatorRequestHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await creatorService.getCreatorRequestHistory();
      setHistory(data);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load request history',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      case 'pending':
        return '#FF9500';
      default:
        return '#8E8E93';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'pending':
        return 'Pending Approval';
      default:
        return 'Not Registered';
    }
  };

  if (isLoading && !history) {
    return <LoadingSpinner fullScreen />;
  }

  if (!history) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load request history</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(history.creatorStatus);
  const statusIcon = getStatusIcon(history.creatorStatus);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Creator Request History</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusIconContainer, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name={statusIcon} size={48} color={statusColor} />
          </View>
          <Text style={styles.statusTitle}>Request Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusText(history.creatorStatus)}
            </Text>
          </View>
        </View>

        {/* Request Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Request Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registration Date</Text>
            <Text style={styles.detailValue}>
              {history.requestedAt
                ? new Date(history.requestedAt).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
                : 'N/A'}
            </Text>
          </View>

          {history.creatorStatus === 'approved' && history.creatorApprovedAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Approved Date</Text>
              <Text style={styles.detailValue}>
                {new Date(history.creatorApprovedAt).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          )}

          {history.creatorApprovedBy && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Approved By</Text>
              <Text style={styles.detailValue}>
                {history.creatorApprovedBy.name} (@{history.creatorApprovedBy.username})
              </Text>
            </View>
          )}
        </View>

        {/* Links Section */}
        {(history.creatorYouTubeUrl || history.creatorInstagramUrl) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Links</Text>

            {history.creatorYouTubeUrl && (
              <View style={styles.linkCard}>
                <Ionicons name="logo-youtube" size={24} color="#FF0000" />
                <View style={styles.linkContent}>
                  <Text style={styles.linkLabel}>YouTube</Text>
                  <Text style={styles.linkValue} numberOfLines={1}>
                    {history.creatorYouTubeUrl}
                  </Text>
                </View>
              </View>
            )}

            {history.creatorInstagramUrl && (
              <View style={styles.linkCard}>
                <Ionicons name="logo-instagram" size={24} color="#E4405F" />
                <View style={styles.linkContent}>
                  <Text style={styles.linkLabel}>Instagram</Text>
                  <Text style={styles.linkValue} numberOfLines={1}>
                    {history.creatorInstagramUrl}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        {history.creatorStatus === 'pending' && (
          <View style={styles.section}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color="#FF9500" />
              <Text style={styles.infoText}>
                Your creator request is pending admin approval. You will be notified once approved.
              </Text>
            </View>
          </View>
        )}

        {history.creatorStatus === 'rejected' && (
          <View style={styles.section}>
            <View style={styles.infoCard}>
              <Ionicons name="alert-circle" size={24} color="#FF3B30" />
              <Text style={styles.infoText}>
                Your creator request was rejected. You can try registering again.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => navigation.navigate(ROUTES.CREATOR_REGISTER)}
            >
              <Ionicons name="star-outline" size={20} color="#FFFFFF" />
              <Text style={styles.registerButtonText}>Register Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {history.creatorStatus === 'approved' && (
          <View style={styles.section}>
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <Text style={styles.successText}>
                Congratulations! You are an approved creator. You can now create tasks and manage your creator wallet.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={() => navigation.navigate(ROUTES.CREATOR_DASHBOARD)}
            >
              <Ionicons name="grid-outline" size={20} color="#FFFFFF" />
              <Text style={styles.dashboardButtonText}>Go to Creator Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}

        {!history.isCreator && (
          <View style={styles.section}>
            <View style={styles.infoCard}>
              <Ionicons name="star-outline" size={24} color="#FF9500" />
              <Text style={styles.infoText}>
                You haven't registered as a creator yet. Register now to start creating tasks!
              </Text>
            </View>
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => navigation.navigate(ROUTES.CREATOR_REGISTER)}
            >
              <Ionicons name="star-outline" size={20} color="#FFFFFF" />
              <Text style={styles.registerButtonText}>Register as Creator</Text>
            </TouchableOpacity>
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
    marginTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
    marginTop: 20,
  },
  placeholder: {
    width: 32,
  },
  content: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    marginTop: 20,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    marginTop: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'right',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  linkContent: {
    flex: 1,
    marginLeft: 12,
  },
  linkLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  linkValue: {
    fontSize: 14,
    color: '#000000',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 12,
    lineHeight: 20,
  },
  successCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 12,
    lineHeight: 20,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9500',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  dashboardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 32,
  },
});

export default CreatorRequestHistoryScreen;

