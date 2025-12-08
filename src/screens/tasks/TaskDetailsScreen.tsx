import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchTaskById } from '@store/slices/taskSlice';
import { formatCoins } from '@utils/validation';
import { ROUTES, TASK_TYPES, API_BASE_URL } from '@constants';
import { taskService } from '@services/taskService';
import Button from '@components/common/Button';
import LoadingSpinner from '@components/common/LoadingSpinner';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const TaskDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { currentTask, isLoading } = useAppSelector((state) => state.tasks);
  const taskId = route.params?.taskId;

  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isInstagramTask =
    currentTask?.type === TASK_TYPES.INSTAGRAM_FOLLOW ||
    currentTask?.type === TASK_TYPES.INSTAGRAM_LIKE;

  const isYouTubeTask = currentTask?.type === TASK_TYPES.YOUTUBE_SUBSCRIBE;

  const requiresProof = isInstagramTask || isYouTubeTask;

  useEffect(() => {
    if (taskId) {
      loadTask();
    }
  }, [taskId]);

  const loadTask = async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchTaskById(taskId)).unwrap();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error || 'Failed to load task',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenInstagram = async () => {
    if (!currentTask?.instagramUrl) return;

    const url = currentTask.instagramUrl.startsWith('http')
      ? currentTask.instagramUrl
      : `https://${currentTask.instagramUrl}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Cannot open Instagram URL',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open Instagram',
      });
    }
  };

  const handleOpenYouTube = async () => {
    if (!currentTask?.youtubeUrl) return;

    const url = currentTask.youtubeUrl.startsWith('http')
      ? currentTask.youtubeUrl
      : `https://${currentTask.youtubeUrl}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Cannot open YouTube URL',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open YouTube',
      });
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload proof'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProofImage(result.assets[0].uri);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick image',
      });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera permissions to take a photo'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProofImage(result.assets[0].uri);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to take photo',
      });
    }
  };

  const handleShowImageOptions = () => {
    Alert.alert(
      'Upload Proof',
      'Choose an option',
      [
        { text: 'Camera', onPress: handleTakePhoto },
        { text: 'Gallery', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleSubmitProof = async () => {
    if (!proofImage) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please upload a screenshot proof',
      });
      return;
    }

    if (!currentTask) return;

    setIsSubmitting(true);
    try {
      await taskService.submitTaskProof(currentTask.id, proofImage);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Proof submitted successfully! Waiting for admin approval.',
      });
      setProofImage(null);
      loadTask(); // Refresh task to show updated status
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to submit proof',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    if (!currentTask?.submissionStatus) return null;

    const status = currentTask.submissionStatus;
    const statusConfig = {
      available: { color: '#007AFF', text: 'Available', icon: 'checkmark-circle-outline' },
      pending: { color: '#FF9500', text: 'Pending', icon: 'time-outline' },
      approved: { color: '#34C759', text: 'Approved', icon: 'checkmark-circle' },
      rejected: { color: '#FF3B30', text: 'Rejected', icon: 'close-circle' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
        <Ionicons name={config.icon as any} size={16} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>{config.text}</Text>
      </View>
    );
  };

  const getProofImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return `${API_BASE_URL.replace('/api', '')}${imagePath}`;
  };

  if (isLoading || !currentTask) {
    return <LoadingSpinner fullScreen />;
  }

  const submissionStatus = currentTask.submissionStatus || 'available';
  const canSubmit = submissionStatus === 'available' || submissionStatus === 'rejected';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {currentTask.thumbnail && (
        <Image source={{ uri: currentTask.thumbnail }} style={styles.thumbnail} />
      )}

      <View style={styles.details}>
        <View style={styles.header}>
          <Text style={styles.title}>{currentTask.title}</Text>
          {getStatusBadge()}
        </View>

        <View style={styles.coinBadge}>
          <Ionicons name="cash" size={24} color="#FFD700" />
          <Text style={styles.coinText}>{formatCoins(currentTask.coins)} Coins</Text>
        </View>

        <Text style={styles.description}>{currentTask.description}</Text>

        {isInstagramTask && currentTask.instagramUrl && (
          <View style={styles.instagramSection}>
            <Text style={styles.sectionTitle}>Instructions:</Text>
            <View style={styles.instructions}>
              <Text style={styles.instructionText}>1. Click "Open Instagram" button below</Text>
              <Text style={styles.instructionText}>2. Follow the Instagram profile or like the post</Text>
              <Text style={styles.instructionText}>3. Take a screenshot as proof</Text>
              <Text style={styles.instructionText}>4. Upload the screenshot and submit</Text>
            </View>

            <Button
              title="Open Instagram"
              onPress={handleOpenInstagram}
              style={styles.instagramButton}
            />
          </View>
        )}

        {isYouTubeTask && currentTask.youtubeUrl && (
          <View style={styles.instagramSection}>
            <Text style={styles.sectionTitle}>Instructions:</Text>
            <View style={styles.instructions}>
              <Text style={styles.instructionText}>1. Click "Open YouTube" button below</Text>
              <Text style={styles.instructionText}>2. Subscribe to the YouTube channel</Text>
              <Text style={styles.instructionText}>3. Take a screenshot as proof</Text>
              <Text style={styles.instructionText}>4. Upload the screenshot and submit</Text>
            </View>

            <Button
              title="Open YouTube"
              onPress={handleOpenYouTube}
              style={styles.instagramButton}
            />
          </View>
        )}

        {requiresProof && (
          <View style={styles.proofSection}>
            <Text style={styles.sectionTitle}>Upload Proof Screenshot</Text>

            {proofImage ? (
              <View style={styles.proofPreview}>
                <Image source={{ uri: proofImage }} style={styles.proofImage} />
                <TouchableOpacity
                  onPress={() => setProofImage(null)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleShowImageOptions}
                style={styles.uploadButton}
              >
                <Ionicons name="camera-outline" size={32} color="#007AFF" />
                <Text style={styles.uploadText}>Tap to upload screenshot</Text>
                <Text style={styles.uploadHint}>Camera or Gallery</Text>
              </TouchableOpacity>
            )}

            {canSubmit && proofImage && (
              <Button
                title={submissionStatus === 'rejected' ? 'Resubmit Proof' : 'Submit for Verification'}
                onPress={handleSubmitProof}
                loading={isSubmitting}
                style={styles.submitButton}
              />
            )}

            {submissionStatus === 'pending' && (
              <View style={styles.pendingInfo}>
                <Ionicons name="time-outline" size={20} color="#FF9500" />
                <Text style={styles.pendingText}>
                  Your task is under review. Coins will be added after approval.
                </Text>
              </View>
            )}

            {submissionStatus === 'approved' && (
              <View style={styles.approvedInfo}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.approvedText}>
                  Task approved! {formatCoins(currentTask.coins)} coins have been added to your wallet.
                </Text>
              </View>
            )}

            {submissionStatus === 'rejected' && currentTask.rejectionReason && (
              <View style={styles.rejectedInfo}>
                <Ionicons name="alert-circle" size={20} color="#FF3B30" />
                <Text style={styles.rejectedText}>
                  Rejection Reason: {currentTask.rejectionReason}
                </Text>
                <Text style={styles.resubmitHint}>
                  Please upload a new proof and resubmit.
                </Text>
              </View>
            )}
          </View>
        )}

        {!requiresProof && !currentTask.isCompleted && (
          <Button
            title="Start Task"
            onPress={() => {
              if (currentTask.type === TASK_TYPES.WATCH_VIDEO) {
                navigation.navigate(ROUTES.VIDEO_PLAYER, { task: currentTask });
              }
            }}
            style={styles.startButton}
          />
        )}

        {currentTask.isCompleted && currentTask.completedAt && (
          <View style={styles.completedInfo}>
            <Text style={styles.completedInfoText}>
              Completed on {new Date(currentTask.completedAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingBottom: 20,
  },
  thumbnail: {
    width: '100%',
    height: 250,
    backgroundColor: '#F2F2F7',
  },
  details: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  coinText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9500',
    marginLeft: 8,
  },
  description: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
    marginBottom: 24,
  },
  instagramSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  instructions: {
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 22,
    marginBottom: 8,
  },
  instagramButton: {
    marginTop: 8,
  },
  proofSection: {
    marginBottom: 24,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 12,
  },
  uploadHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  proofPreview: {
    position: 'relative',
    marginBottom: 16,
  },
  proofImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  submitButton: {
    marginTop: 16,
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  pendingText: {
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 8,
    flex: 1,
  },
  approvedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4EDDA',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  approvedText: {
    fontSize: 14,
    color: '#34C759',
    marginLeft: 8,
    flex: 1,
  },
  rejectedInfo: {
    backgroundColor: '#F8D7DA',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  rejectedText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 8,
  },
  resubmitHint: {
    fontSize: 12,
    color: '#721C24',
    fontStyle: 'italic',
  },
  startButton: {
    marginTop: 8,
  },
  completedInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  completedInfoText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default TaskDetailsScreen;
