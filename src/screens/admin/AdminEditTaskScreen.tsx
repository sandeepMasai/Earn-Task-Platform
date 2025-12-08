import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { adminTaskService, CreateTaskData } from '@services/adminTaskService';
import { ROUTES } from '../../constants/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const TASK_TYPES = [
  { value: 'watch_video', label: 'Watch Video' },
  { value: 'instagram_follow', label: 'Instagram Follow' },
  { value: 'instagram_like', label: 'Instagram Like' },
  { value: 'youtube_subscribe', label: 'YouTube Subscribe' },
  { value: 'upload_post', label: 'Upload Post' },
];

const AdminEditTaskScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;

  const [type, setType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coins, setCoins] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTask, setIsLoadingTask] = useState(true);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      setIsLoadingTask(true);
      const task = await adminTaskService.getTaskById(taskId);
      
      setType(task.type);
      setTitle(task.title);
      setDescription(task.description);
      setCoins(task.coins.toString());
      setVideoUrl(task.videoUrl || '');
      setVideoDuration(task.videoDuration?.toString() || '');
      setInstagramUrl(task.instagramUrl || '');
      setYoutubeUrl(task.youtubeUrl || '');
      setIsActive(task.isActive);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load task',
      });
      navigation.goBack();
    } finally {
      setIsLoadingTask(false);
    }
  };

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

    if (!coins || parseInt(coins) <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Coins must be greater than 0',
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

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);

      const taskData: Partial<CreateTaskData> = {
        type,
        title: title.trim(),
        description: description.trim(),
        coins: parseInt(coins),
        isActive,
      };

      if (type === 'watch_video') {
        taskData.videoUrl = videoUrl.trim();
        if (videoDuration) {
          taskData.videoDuration = parseInt(videoDuration);
        } else {
          taskData.videoDuration = null;
        }
      }

      if (type === 'instagram_follow' || type === 'instagram_like') {
        taskData.instagramUrl = instagramUrl.trim();
      }

      if (type === 'youtube_subscribe') {
        taskData.youtubeUrl = youtubeUrl.trim();
      }

      await adminTaskService.updateTask(taskId, taskData);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Task updated successfully',
      });

      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update task',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const showTypePicker = () => {
    Alert.alert(
      'Select Task Type',
      'Choose the type of task',
      [
        ...TASK_TYPES.map((taskType) => ({
          text: taskType.label,
          onPress: () => setType(taskType.value),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (isLoadingTask) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Task</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Task Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Task Type *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={showTypePicker}
            >
              <Text style={[styles.pickerText, !type && styles.placeholderText]}>
                {type ? TASK_TYPES.find((t) => t.value === type)?.label : 'Select task type'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter task title"
              placeholderTextColor="#8E8E93"
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter task description"
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Coins */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Coins Reward *</Text>
            <TextInput
              style={styles.input}
              value={coins}
              onChangeText={setCoins}
              placeholder="Enter coin reward amount"
              placeholderTextColor="#8E8E93"
              keyboardType="number-pad"
            />
          </View>

          {/* Conditional Fields */}
          {type === 'watch_video' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Video URL *</Text>
                <TextInput
                  style={styles.input}
                  value={videoUrl}
                  onChangeText={setVideoUrl}
                  placeholder="Enter video URL"
                  placeholderTextColor="#8E8E93"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Video Duration (seconds)</Text>
                <TextInput
                  style={styles.input}
                  value={videoDuration}
                  onChangeText={setVideoDuration}
                  placeholder="Enter video duration in seconds"
                  placeholderTextColor="#8E8E93"
                  keyboardType="number-pad"
                />
              </View>
            </>
          )}

          {(type === 'instagram_follow' || type === 'instagram_like') && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Instagram URL *</Text>
              <TextInput
                style={styles.input}
                value={instagramUrl}
                onChangeText={setInstagramUrl}
                placeholder="Enter Instagram URL"
                placeholderTextColor="#8E8E93"
                autoCapitalize="none"
              />
            </View>
          )}

          {type === 'youtube_subscribe' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>YouTube URL *</Text>
              <TextInput
                style={styles.input}
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                placeholder="Enter YouTube channel URL"
                placeholderTextColor="#8E8E93"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Active Status */}
          <View style={styles.inputGroup}>
            <TouchableOpacity
              style={styles.switchContainer}
              onPress={() => setIsActive(!isActive)}
            >
              <Text style={styles.label}>Active</Text>
              <View style={[styles.switch, isActive && styles.switchActive]}>
                <View style={[styles.switchThumb, isActive && styles.switchThumbActive]} />
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Action Buttons */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            disabled={isLoading}
          >
            <Text style={[styles.saveText, isLoading && styles.saveTextDisabled]}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F5F5F5',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  pickerButton: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 16,
    color: '#000000',
  },
  placeholderText: {
    color: '#8E8E93',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: '#34C759',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#8E8E93',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveTextDisabled: {
    color: '#FFFFFF',
  },
});

export default AdminEditTaskScreen;

