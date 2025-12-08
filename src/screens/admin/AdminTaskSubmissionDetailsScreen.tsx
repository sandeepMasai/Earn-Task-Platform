import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { adminService, TaskSubmission } from '@services/adminService';
import { formatCoins, formatDate } from '@utils/validation';
import { API_BASE_URL } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const AdminTaskSubmissionDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const submissionId = route.params?.submissionId;

  const [submission, setSubmission] = useState<TaskSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    try {
      const data = await adminService.getTaskSubmissionById(submissionId);
      setSubmission(data);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load submission',
      });
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = () => {
    if (!submission) return;

    Alert.alert(
      'Approve Submission',
      `Are you sure you want to approve this submission? ${formatCoins(submission.task.coins)} coins will be credited to the user.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await adminService.approveTaskSubmission(submission.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Task approved and coins credited successfully',
              });
              loadSubmission(); // Reload to show updated status
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to approve submission',
              });
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    if (!submission) return;
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!submission) return;

    setIsProcessing(true);
    try {
      await adminService.rejectTaskSubmission(
        submission.id,
        rejectionReason || 'Proof verification failed'
      );
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Task submission rejected',
      });
      setShowRejectModal(false);
      setRejectionReason('');
      loadSubmission(); // Reload to show updated status
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to reject submission',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getProofImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return `${API_BASE_URL.replace('/api', '')}${imagePath}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  if (isLoading || !submission) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Submission Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>{submission.user.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username:</Text>
              <Text style={styles.infoValue}>@{submission.user.username}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{submission.user.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User ID:</Text>
              <Text style={styles.infoValue}>{submission.user.id}</Text>
            </View>
          </View>
        </View>

        {/* Task Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Task Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Task Title:</Text>
              <Text style={styles.infoValue}>{submission.task.title}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Task Type:</Text>
              <Text style={styles.infoValue}>
                {submission.task.type === 'instagram_follow'
                  ? 'Instagram Follow'
                  : submission.task.type === 'instagram_like'
                  ? 'Instagram Like'
                  : submission.task.type === 'youtube_subscribe'
                  ? 'YouTube Subscribe'
                  : submission.task.type}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Coin Reward:</Text>
              <Text style={styles.infoValue}>{formatCoins(submission.task.coins)}</Text>
            </View>
            {submission.task.instagramUrl && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Instagram URL:</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {submission.task.instagramUrl}
                </Text>
              </View>
            )}
            {submission.task.youtubeUrl && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>YouTube URL:</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {submission.task.youtubeUrl}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Submission Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Submission Status</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${getStatusColor(submission.status)}20` },
                ]}
              >
                <Ionicons
                  name={
                    submission.status === 'pending'
                      ? 'time-outline'
                      : submission.status === 'approved'
                      ? 'checkmark-circle'
                      : 'close-circle'
                  }
                  size={16}
                  color={getStatusColor(submission.status)}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(submission.status) },
                  ]}
                >
                  {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Submitted At:</Text>
              <Text style={styles.infoValue}>{formatDate(submission.submittedAt)}</Text>
            </View>
            {submission.reviewedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reviewed At:</Text>
                <Text style={styles.infoValue}>{formatDate(submission.reviewedAt)}</Text>
              </View>
            )}
            {submission.reviewedBy && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reviewed By:</Text>
                <Text style={styles.infoValue}>
                  {submission.reviewedBy.name} (@{submission.reviewedBy.username})
                </Text>
              </View>
            )}
            {submission.rejectionReason && (
              <View style={styles.rejectionReason}>
                <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                <Text style={styles.rejectionText}>{submission.rejectionReason}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Proof Image */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proof Screenshot</Text>
          <View style={styles.proofContainer}>
            <Image
              source={{ uri: getProofImageUrl(submission.proofImage) }}
              style={styles.proofImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {submission.status === 'pending' && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={isProcessing}
          >
            <Ionicons name="close-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={handleApprove}
            disabled={isProcessing}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Submission</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejection (optional)
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Enter rejection reason..."
              placeholderTextColor="#8E8E93"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmRejectButton]}
                onPress={handleConfirmReject}
                disabled={isProcessing}
              >
                <Text style={styles.modalButtonText}>
                  {isProcessing ? 'Processing...' : 'Reject'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  rejectionReason: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8D7DA',
    borderRadius: 8,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#721C24',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    color: '#721C24',
  },
  proofContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  proofImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000000',
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  confirmRejectButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AdminTaskSubmissionDetailsScreen;

