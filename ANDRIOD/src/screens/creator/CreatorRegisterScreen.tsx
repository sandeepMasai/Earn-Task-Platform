import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { creatorService } from '@services/creatorService';
import { ROUTES } from '@constants';
import Input from '@components/common/Input';
import Button from '@components/common/Button';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const CreatorRegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!youtubeUrl.trim() && !instagramUrl.trim()) {
      setError('At least one URL (YouTube or Instagram) is required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await creatorService.registerAsCreator(
        youtubeUrl.trim() || undefined,
        instagramUrl.trim() || undefined
      );
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Creator registration submitted! Waiting for admin approval.',
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to register as creator',
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Become a Creator</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <Text style={styles.infoText}>
            Register as a creator to create tasks and promote your content. Admin approval required.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="YouTube Channel URL (Optional)"
            placeholder="https://youtube.com/@yourchannel"
            value={youtubeUrl}
            onChangeText={(text) => {
              setYoutubeUrl(text);
              setError('');
            }}
            autoCapitalize="none"
            keyboardType="url"
            containerStyle={styles.input}
          />

          <Input
            label="Instagram Profile URL (Optional)"
            placeholder="https://instagram.com/yourprofile"
            value={instagramUrl}
            onChangeText={(text) => {
              setInstagramUrl(text);
              setError('');
            }}
            autoCapitalize="none"
            keyboardType="url"
            containerStyle={styles.input}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.hint}>
            Note: At least one URL (YouTube or Instagram) is required to register as a creator.
          </Text>

          <Button
            title="Submit Registration"
            onPress={handleSubmit}
            loading={loading}
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
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 12,
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  submitButton: {
    marginTop: 8,
  },
});

export default CreatorRegisterScreen;

