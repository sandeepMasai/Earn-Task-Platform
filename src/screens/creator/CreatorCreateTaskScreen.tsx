import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { creatorService } from '@services/creatorService';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { refreshUser } from '@store/slices/authSlice';
import { formatCoins } from '@utils/validation';
import { ROUTES } from '@constants';
import Input from '@components/common/Input';
import Button from '@components/common/Button';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const TASK_TYPES = [
  { value: 'watch_video', label: 'Watch Video' },
  { value: 'instagram_follow', label: 'Instagram Follow' },
  { value: 'instagram_like', label: 'Instagram Like' },
  { value: 'youtube_subscribe', label: 'YouTube Subscribe' },
  { value: 'upload_post', label: 'Upload Post' },
];

const CreatorCreateTaskScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [type, setType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardPerUser, setRewardPerUser] = useState('');
  const [maxUsers, setMaxUsers] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [creatorWallet, setCreatorWallet] = useState<number>(0);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);

  // Fetch latest wallet balance from dashboard
  const loadWalletBalance = async () => {
    try {
      setIsLoadingWallet(true);
      const dashboard = await creatorService.getCreatorDashboard();
      setCreatorWallet(dashboard.creatorWallet || 0);
      // Also refresh user data to keep Redux in sync
      await dispatch(refreshUser());
    } catch (error: any) {
      console.error('Failed to load wallet balance:', error);
      // Fallback to Redux state if API fails
      setCreatorWallet(user?.creatorWallet || 0);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  // Load wallet balance when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      loadWalletBalance();
    }, [])
  );

  // Also load on mount
  useEffect(() => {
    loadWalletBalance();
  }, []);
  const rewardValue = parseInt(rewardPerUser) || 0;
  const maxUsersValue = parseInt(maxUsers) || 0;
  const totalCost = rewardValue * maxUsersValue;
  const canAfford = creatorWallet >= totalCost;

  const validateForm = (): boolean => {
    if (!type) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select a task type',
      });
      return false;
    }

    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Title is required',
      });
      return false;
    }

    if (!description.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Description is required',
      });
      return false;
    }

    if (!rewardPerUser || rewardValue <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Reward per user must be greater than 0',
      });
      return false;
    }

    if (!maxUsers || maxUsersValue <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Max users must be greater than 0',
      });
      return false;
    }

    if (!canAfford) {
      Toast.show({
        type: 'error',
        text1: 'Insufficient Balance',
        text2: `You need ${formatCoins(totalCost)} but have ${formatCoins(creatorWallet)}`,
      });
      return false;
    }

    // Type-specific validation
    if (type === 'watch_video' && !videoUrl.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Video URL is required for watch video tasks',
      });
      return false;
    }

    if ((type === 'instagram_follow' || type === 'instagram_like') && !instagramUrl.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Instagram URL is required for Instagram tasks',
      });
      return false;
    }

    if (type === 'youtube_subscribe' && !youtubeUrl.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'YouTube URL is required for YouTube subscribe tasks',
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    Alert.alert(
      'Confirm Task Creation',
      `This will deduct ${formatCoins(totalCost)} from your creator wallet.\n\nReward: ${formatCoins(rewardValue)} per user\nMax Users: ${maxUsersValue}\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            setIsLoading(true);
            try {
              const taskData: any = {
                type,
                title: title.trim(),
                description: description.trim(),
                rewardPerUser: rewardValue,
                maxUsers: maxUsersValue,
              };

              if (videoUrl.trim()) taskData.videoUrl = videoUrl.trim();
              if (videoDuration) taskData.videoDuration = parseInt(videoDuration);
              if (instagramUrl.trim()) taskData.instagramUrl = instagramUrl.trim();
              if (youtubeUrl.trim()) taskData.youtubeUrl = youtubeUrl.trim();

              const response = await creatorService.createTask(taskData);
              // Update wallet balance from response
              if (response.creatorWallet !== undefined) {
                setCreatorWallet(response.creatorWallet);
              }
              // Refresh user data
              await dispatch(refreshUser());
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Task created successfully!',
              });
              navigation.goBack();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to create task',
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Task</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Wallet Info */}
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Creator Wallet</Text>
          {isLoadingWallet ? (
            <Text style={styles.walletAmount}>Loading...</Text>
          ) : (
            <Text style={styles.walletAmount}>{formatCoins(creatorWallet)}</Text>
          )}
        </View>

        {/* Budget Calculator */}
        {rewardValue > 0 && maxUsersValue > 0 && (
          <View style={styles.budgetCard}>
            <Text style={styles.budgetTitle}>Budget Calculation</Text>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Reward per user:</Text>
              <Text style={styles.budgetValue}>{formatCoins(rewardValue)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Max users:</Text>
              <Text style={styles.budgetValue}>{maxUsersValue}</Text>
            </View>
            <View style={styles.budgetDivider} />
            <View style={styles.budgetRow}>
              <Text style={styles.budgetTotalLabel}>Total Cost:</Text>
              <Text
                style={[
                  styles.budgetTotalValue,
                  { color: canAfford ? '#34C759' : '#FF3B30' },
                ]}
              >
                {formatCoins(totalCost)}
              </Text>
            </View>
            {!canAfford && (
              <Text style={styles.insufficientText}>
                Insufficient balance. You need {formatCoins(totalCost - creatorWallet)} more.
              </Text>
            )}
          </View>
        )}

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Task Details</Text>

          <View style={styles.typeSelector}>
            <Text style={styles.label}>Task Type *</Text>
            <View style={styles.typeGrid}>
              {TASK_TYPES.map((taskType) => (
                <TouchableOpacity
                  key={taskType.value}
                  style={[
                    styles.typeButton,
                    type === taskType.value && styles.typeButtonActive,
                  ]}
                  onPress={() => setType(taskType.value)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      type === taskType.value && styles.typeButtonTextActive,
                    ]}
                  >
                    {taskType.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Title *"
            placeholder="Enter task title"
            value={title}
            onChangeText={setTitle}
            containerStyle={styles.input}
          />

          <Input
            label="Description *"
            placeholder="Enter task description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            containerStyle={styles.input}
          />

          <View style={styles.rewardRow}>
            <View style={styles.rewardInput}>
              <Input
                label="Reward per User *"
                placeholder="Coins"
                value={rewardPerUser}
                onChangeText={(text) => setRewardPerUser(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                containerStyle={styles.input}
              />
            </View>
            <View style={styles.rewardInput}>
              <Input
                label="Max Users *"
                placeholder="Count"
                value={maxUsers}
                onChangeText={(text) => setMaxUsers(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                containerStyle={styles.input}
              />
            </View>
          </View>

          {type === 'watch_video' && (
            <>
              <Input
                label="Video URL *"
                placeholder="https://..."
                value={videoUrl}
                onChangeText={setVideoUrl}
                autoCapitalize="none"
                keyboardType="url"
                containerStyle={styles.input}
              />
              <Input
                label="Video Duration (seconds)"
                placeholder="60"
                value={videoDuration}
                onChangeText={(text) => setVideoDuration(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                containerStyle={styles.input}
              />
            </>
          )}

          {(type === 'instagram_follow' || type === 'instagram_like') && (
            <Input
              label="Instagram URL *"
              placeholder="https://instagram.com/..."
              value={instagramUrl}
              onChangeText={setInstagramUrl}
              autoCapitalize="none"
              keyboardType="url"
              containerStyle={styles.input}
            />
          )}

          {type === 'youtube_subscribe' && (
            <Input
              label="YouTube URL *"
              placeholder="https://youtube.com/..."
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              autoCapitalize="none"
              keyboardType="url"
              containerStyle={styles.input}
            />
          )}

          <Button
            title="Create Task"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!canAfford}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  walletAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  budgetCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  budgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  budgetDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  budgetTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  budgetTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  insufficientText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 8,
    fontStyle: 'italic',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  typeSelector: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    marginBottom: 16,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rewardInput: {
    flex: 1,
  },
  submitButton: {
    marginTop: 8,
  },
});

export default CreatorCreateTaskScreen;

