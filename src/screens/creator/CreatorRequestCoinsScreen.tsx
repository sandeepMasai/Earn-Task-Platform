import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { creatorService } from '@services/creatorService';
import { formatCoins, formatCurrency } from '@utils/validation';
import { ROUTES } from '@constants';
import Input from '@components/common/Input';
import Button from '@components/common/Button';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const CreatorRequestCoinsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [coins, setCoins] = useState('');
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const MIN_COINS = 1000;
  const MAX_COINS = 100000;
  const COINS_PER_RUPEE = 100; // 1000 coins = 10 rupees
  const UPI_ID = 'sk245444@ybl';

  const calculateAmount = (coinValue: number) => {
    return (coinValue / COINS_PER_RUPEE).toFixed(2);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload payment proof'
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
        setPaymentProof(result.assets[0].uri);
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
        setPaymentProof(result.assets[0].uri);
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
      'Upload Payment Proof',
      'Choose an option',
      [
        { text: 'Camera', onPress: handleTakePhoto },
        { text: 'Gallery', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleSubmit = async () => {
    const coinValue = parseInt(coins);

    if (!coins || isNaN(coinValue) || coinValue < MIN_COINS) {
      setError(`Minimum ${formatCoins(MIN_COINS)} coins required`);
      return;
    }

    if (coinValue > MAX_COINS) {
      setError(`Maximum ${formatCoins(MAX_COINS)} coins allowed`);
      return;
    }

    if (!paymentProof) {
      setError('Payment proof screenshot is required. Please upload payment proof before sending.');
      return;
    }

    // Final validation before sending
    Alert.alert(
      'Confirm Coin Request',
      `You are requesting ${formatCoins(coinValue)} coins (₹${calculateAmount(coinValue)}).\n\nPayment proof has been uploaded.\n\nSend this request to admin for approval?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async () => {
            setError('');
            setLoading(true);

            try {
              await creatorService.requestCoins(coinValue, paymentProof);
              Toast.show({
                type: 'success',
                text1: 'Request Sent!',
                text2: 'Your coin request has been sent. Waiting for admin approval.',
              });
              // Clear form after successful submission
              setCoins('');
              setPaymentProof(null);
              setTimeout(() => {
                navigation.goBack();
              }, 1500);
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to send coin request',
              });
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const coinValue = parseInt(coins) || 0;
  const amount = coinValue >= MIN_COINS ? calculateAmount(coinValue) : '0.00';

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
        <Text style={styles.title}>Request Coins</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <Text style={styles.infoText}>
            Rate: {formatCoins(COINS_PER_RUPEE)} = ₹1.00{'\n'}
            Minimum: {formatCoins(MIN_COINS)} coins{'\n'}
            Maximum: {formatCoins(MAX_COINS)} coins
          </Text>
        </View>

        {/* Payment UPI Details */}
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment Details</Text>
          <View style={styles.upiSection}>
            <Ionicons name="wallet-outline" size={20} color="#007AFF" />
            <View style={styles.upiInfo}>
              <Text style={styles.upiLabel}>UPI ID</Text>
              <Text style={styles.upiValue}>{UPI_ID}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                // Copy to clipboard functionality can be added here
                Alert.alert('UPI ID', `UPI ID: ${UPI_ID}\n\nCopy this UPI ID to make payment`);
              }}
            >
              <Ionicons name="copy-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.paymentHint}>
            Send payment to the UPI ID above and upload the payment screenshot as proof.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Coins Amount"
            placeholder={`Minimum ${formatCoins(MIN_COINS)}`}
            value={coins}
            onChangeText={(text) => {
              const numericValue = text.replace(/[^0-9]/g, '');
              const coinValue = parseInt(numericValue) || 0;
              if (coinValue <= MAX_COINS) {
                setCoins(numericValue);
                setError('');
              } else {
                setError(`Maximum ${formatCoins(MAX_COINS)} coins allowed`);
              }
            }}
            keyboardType="numeric"
            containerStyle={styles.input}
            maxLength={6}
          />

          {coins && parseInt(coins) >= MIN_COINS && (
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Amount to Pay</Text>
              <Text style={styles.amountValue}>₹{calculateAmount(parseInt(coins))}</Text>
              <Text style={styles.amountHint}>
                You will receive {formatCoins(parseInt(coins))} coins after admin approval
              </Text>
            </View>
          )}

          <View style={styles.proofSection}>
            <Text style={styles.proofLabel}>Payment Proof Screenshot *</Text>
            <Text style={styles.proofSubLabel}>
              Upload screenshot of payment made to UPI ID: {UPI_ID}
            </Text>
            {paymentProof ? (
              <View style={styles.proofPreview}>
                <Image source={{ uri: paymentProof }} style={styles.proofImage} />
                <TouchableOpacity
                  onPress={() => setPaymentProof(null)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
                <View style={styles.proofStatus}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.proofStatusText}>Payment proof uploaded</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleShowImageOptions}
                style={styles.uploadButton}
              >
                <Ionicons name="camera-outline" size={32} color="#007AFF" />
                <Text style={styles.uploadText}>Tap to upload payment proof</Text>
                <Text style={styles.uploadHint}>Camera or Gallery</Text>
              </TouchableOpacity>
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonContainer}>
            <Button
              title="Send Coin Request"
              onPress={handleSubmit}
              loading={loading}
              disabled={!paymentProof || !coins || parseInt(coins) < MIN_COINS || parseInt(coins) > MAX_COINS}
              style={styles.submitButton}
            />
            <Text style={styles.submitHint}>
              Make sure you have uploaded payment proof before sending
            </Text>
          </View>
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
  amountCard: {
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF9500',
    marginBottom: 8,
  },
  amountHint: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  paymentCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 12,
    marginTop: 20,
  },
  upiSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  upiInfo: {
    flex: 1,
    marginLeft: 12,
  },
  upiLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  upiValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  paymentHint: {
    fontSize: 12,
    color: '#1976D2',
    fontStyle: 'italic',
    marginTop: 8,
  },
  proofSection: {
    marginBottom: 24,
  },
  proofLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  proofSubLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 12,
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
    padding: 4,
  },
  proofStatus: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  proofStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 8,
  },
});

export default CreatorRequestCoinsScreen;

