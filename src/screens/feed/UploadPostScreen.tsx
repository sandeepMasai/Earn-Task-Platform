import React, { useState } from 'react';
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

const UploadPostScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

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
      setImageUri(result.assets[0].uri);
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
      setImageUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!imageUri) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select an image',
      });
      return;
    }

    setLoading(true);
    try {
      await dispatch(uploadPost({ imageUri, caption })).unwrap();
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageSection}>
          {imageUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setImageUri(null)}
              >
                <Ionicons name="close-circle" size={32} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="image-outline" size={64} color="#8E8E93" />
              <Text style={styles.placeholderText}>No image selected</Text>
              <View style={styles.imageButtons}>
                <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                  <Ionicons name="images" size={24} color="#007AFF" />
                  <Text style={styles.imageButtonText}>Choose from Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                  <Ionicons name="camera" size={24} color="#007AFF" />
                  <Text style={styles.imageButtonText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

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
              You'll earn {COIN_VALUES.POST_UPLOAD} coins for uploading a post
            </Text>
          </View>

          <Button
            title="Upload Post"
            onPress={handleUpload}
            loading={loading}
            disabled={!imageUri}
            style={styles.uploadButton}
          />
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
  imageSection: {
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
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
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  imageButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 8,
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
});

export default UploadPostScreen;

