import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@store/hooks';
import { uploadPost } from '@store/slices/feedSlice';
import { addCoins } from '@store/slices/walletSlice';
import { updateUserCoins } from '@store/slices/authSlice';
import { COIN_VALUES, SUCCESS_MESSAGES } from '@constants';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

type PostType = 'image' | 'video' | 'document';

const UploadPostScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const [postType, setPostType] = useState<PostType>('image');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | undefined>();

  // Video player for preview - always call hook with a valid source
  // Use a placeholder URI when no video is selected to avoid hook order issues
  const videoSource = fileUri && postType === 'video' ? fileUri : 'file://placeholder';
  const videoPlayer = useVideoPlayer(videoSource, (player) => {
    if (fileUri && postType === 'video') {
      player.loop = true;
      player.muted = true;
    }
  });

  // Only use player when we have a valid video URI
  const activeVideoPlayer = fileUri && postType === 'video' ? videoPlayer : null;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'We need access to your photos to upload posts.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setPostType('image');
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'We need access to your videos to upload posts.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true, // This enables trimming on iOS/Android
      videoMaxDuration: 120, // 2 minutes max - will auto-trim if longer
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const durationMs = result.assets[0].duration || 0;
      const durationSeconds = durationMs / 1000;

      // Validate minimum duration (10 seconds)
      if (durationSeconds < 10) {
        Toast.show({
          type: 'error',
          text1: 'Video Too Short',
          text2: 'Video must be at least 10 seconds long.',
        });
        return;
      }

      // Validate maximum duration (2 minutes = 120 seconds)
      // If video is longer, it should be trimmed by ImagePicker
      if (durationSeconds > 120) {
        Toast.show({
          type: 'error',
          text1: 'Video Too Long',
          text2: 'Video must be 2 minutes or less. Please trim your video using the editor.',
        });
        return;
      }

      setFileUri(result.assets[0].uri);
      setVideoDuration(durationSeconds);
      setPostType('video');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setFileUri(result.assets[0].uri);
        setPostType('document');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to pick document',
      });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'We need access to your camera to take photos.',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setPostType('image');
    }
  };

  const takeVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'We need access to your camera to record videos.',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true, // This enables trimming after recording
      videoMaxDuration: 120, // 2 minutes max - will stop recording at 2 minutes
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const durationMs = result.assets[0].duration || 0;
      const durationSeconds = durationMs / 1000;

      // Validate minimum duration (10 seconds)
      if (durationSeconds < 10) {
        Toast.show({
          type: 'error',
          text1: 'Video Too Short',
          text2: 'Video must be at least 10 seconds long. Please record a longer video.',
        });
        return;
      }

      // Validate maximum duration (2 minutes = 120 seconds)
      if (durationSeconds > 120) {
        Toast.show({
          type: 'error',
          text1: 'Video Too Long',
          text2: 'Video must be 2 minutes or less. Please trim your video using the editor.',
        });
        return;
      }

      setFileUri(result.assets[0].uri);
      setVideoDuration(durationSeconds);
      setPostType('video');
    }
  };

  const handleUpload = async () => {
    if (!fileUri) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select a file',
      });
      return;
    }

    // Validate video duration before upload
    if (postType === 'video') {
      if (!videoDuration) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Unable to determine video duration. Please select the video again.',
        });
        return;
      }

      if (videoDuration < 10) {
        Toast.show({
          type: 'error',
          text1: 'Video Too Short',
          text2: 'Video must be at least 10 seconds long.',
        });
        return;
      }

      if (videoDuration > 120) {
        Toast.show({
          type: 'error',
          text1: 'Video Too Long',
          text2: 'Video must be 2 minutes (120 seconds) or less. Please trim your video.',
        });
        return;
      }
    }

    setLoading(true);
    try {
      await dispatch(
        uploadPost({
          fileUri,
          caption,
          type: postType,
          videoDuration,
        })
      ).unwrap();
      dispatch(addCoins(COIN_VALUES.POST_UPLOAD));
      dispatch(updateUserCoins(COIN_VALUES.POST_UPLOAD));
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: SUCCESS_MESSAGES.POST_UPLOADED,
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error || 'Failed to upload post',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Post Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, postType === 'image' && styles.typeButtonActive]}
            onPress={() => {
              setPostType('image');
              setFileUri(null);
              setVideoDuration(undefined);
            }}
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={postType === 'image' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text
              style={[
                styles.typeButtonText,
                postType === 'image' && styles.typeButtonTextActive,
              ]}
            >
              Image
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, postType === 'video' && styles.typeButtonActive]}
            onPress={() => {
              setPostType('video');
              setFileUri(null);
              setVideoDuration(undefined);
            }}
          >
            <Ionicons
              name="videocam-outline"
              size={24}
              color={postType === 'video' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text
              style={[
                styles.typeButtonText,
                postType === 'video' && styles.typeButtonTextActive,
              ]}
            >
              Video
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, postType === 'document' && styles.typeButtonActive]}
            onPress={() => {
              setPostType('document');
              setFileUri(null);
            }}
          >
            <Ionicons
              name="document-text-outline"
              size={24}
              color={postType === 'document' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text
              style={[
                styles.typeButtonText,
                postType === 'document' && styles.typeButtonTextActive,
              ]}
            >
              Document
            </Text>
          </TouchableOpacity>
        </View>

        {/* Media Preview */}
        <View style={styles.mediaSection}>
          {fileUri ? (
            <View style={styles.mediaContainer}>
              {postType === 'image' ? (
                <Image source={{ uri: fileUri }} style={styles.media} />
              ) : postType === 'video' && activeVideoPlayer ? (
                <View style={styles.videoContainer}>
                  <VideoView
                    player={activeVideoPlayer}
                    style={styles.media}
                    fullscreenOptions={{
                      enterFullscreen: true,
                      exitFullscreen: true,
                    }}
                    allowsPictureInPicture
                    nativeControls={false}
                    contentFit="cover"
                  />
                  {videoDuration && (
                    <>
                      <View style={styles.durationBadge}>
                        <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.durationText}>
                          {formatDuration(videoDuration)}
                        </Text>
                      </View>
                      {videoDuration < 10 && (
                        <View style={styles.warningBadge}>
                          <Ionicons name="warning" size={14} color="#FFFFFF" />
                          <Text style={styles.warningText}>Min 10s</Text>
                        </View>
                      )}
                      {videoDuration > 120 && (
                        <View style={styles.errorBadge}>
                          <Ionicons name="close-circle" size={14} color="#FFFFFF" />
                          <Text style={styles.errorText}>Max 2min</Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.documentContainer}>
                  <Ionicons name="document-text" size={64} color="#007AFF" />
                  <Text style={styles.documentText}>Document Selected</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => {
                  setFileUri(null);
                  setVideoDuration(undefined);
                }}
              >
                <Ionicons name="close-circle" size={32} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons
                name={
                  postType === 'image'
                    ? 'image-outline'
                    : postType === 'video'
                      ? 'videocam-outline'
                      : 'document-text-outline'
                }
                size={64}
                color="#8E8E93"
              />
              <Text style={styles.placeholderText}>
                No {postType} selected
              </Text>
              <View style={styles.mediaButtons}>
                {postType === 'image' ? (
                  <>
                    <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                      <Ionicons name="images" size={24} color="#007AFF" />
                      <Text style={styles.mediaButtonText}>Choose Image</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                      <Ionicons name="camera" size={24} color="#007AFF" />
                      <Text style={styles.mediaButtonText}>Take Photo</Text>
                    </TouchableOpacity>
                  </>
                ) : postType === 'video' ? (
                  <>
                    <TouchableOpacity style={styles.mediaButton} onPress={pickVideo}>
                      <Ionicons name="film" size={24} color="#007AFF" />
                      <Text style={styles.mediaButtonText}>Choose Video</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mediaButton} onPress={takeVideo}>
                      <Ionicons name="videocam" size={24} color="#007AFF" />
                      <Text style={styles.mediaButtonText}>Record Video</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.mediaButton} onPress={pickDocument}>
                    <Ionicons name="folder-open" size={24} color="#007AFF" />
                    <Text style={styles.mediaButtonText}>Choose Document</Text>
                  </TouchableOpacity>
                )}
              </View>
              {postType === 'video' && (
                <Text style={styles.videoHint}>
                  Video length: 10 seconds to 2 minutes
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Caption Input */}
        <View style={styles.formSection}>
          <Input
            label="Caption"
            placeholder="Write a caption for your post..."
            value={caption}
            onChangeText={setCaption}
            multiline
            numberOfLines={4}
            style={styles.captionInput}
            containerStyle={styles.inputContainer}
          />

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              You'll earn {formatCoins(COIN_VALUES.POST_UPLOAD)} coins for uploading a post
            </Text>
          </View>

          <Button
            title="Upload Post"
            onPress={handleUpload}
            loading={loading}
            disabled={
              !fileUri ||
              (postType === 'video' && videoDuration !== undefined && (videoDuration < 10 || videoDuration > 120))
            }
            style={styles.uploadButton}
          />
          {postType === 'video' && videoDuration !== undefined && (videoDuration < 10 || videoDuration > 120) && (
            <Text style={styles.validationError}>
              {videoDuration < 10
                ? 'Video must be at least 10 seconds long'
                : 'Video must be 2 minutes or less. Please trim your video using the editor.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  mediaSection: {
    marginBottom: 24,
  },
  mediaContainer: {
    position: 'relative',
  },
  media: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  videoContainer: {
    position: 'relative',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
    gap: 2,
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
    gap: 2,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  documentContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentText: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 12,
    fontWeight: '600',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  placeholderContainer: {
    height: 300,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
    marginBottom: 24,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  mediaButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  videoHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 12,
    textAlign: 'center',
  },
  formSection: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  captionInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  uploadButton: {
    marginTop: 8,
  },
  validationError: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 8,
    textAlign: 'center',
  },
});

function formatCoins(coins: number): string {
  return coins.toLocaleString();
}

export default UploadPostScreen;
