import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminService } from '@services/adminService';
import { formatCoins } from '@utils/validation';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

interface WithdrawalSettings {
  minimumWithdrawalAmount: number;
  withdrawalAmounts: number[];
  updatedAt?: string;
  updatedBy?: string;
}

const AdminWithdrawalManagementScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [settings, setSettings] = useState<WithdrawalSettings | null>(null);
  const [minAmount, setMinAmount] = useState<string>('');
  const [amounts, setAmounts] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSettings = async () => {
    try {
      const data = await adminService.getWithdrawalSettings();
      setSettings(data);
      setMinAmount(data.minimumWithdrawalAmount.toString());
      setAmounts(data.withdrawalAmounts.join(', '));
    } catch (error: any) {
      console.error('Error loading withdrawal settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to load withdrawal settings',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadSettings();
  };

  const handleMinAmountChange = (value: string) => {
    // Allow only numbers
    const numValue = value.replace(/[^0-9]/g, '');
    setMinAmount(numValue);
  };

  const handleAmountsChange = (value: string) => {
    setAmounts(value);
  };

  const parseAmounts = (value: string): number[] => {
    return value
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0)
      .map((a) => parseInt(a.replace(/[^0-9]/g, ''), 10))
      .filter((a) => !isNaN(a) && a > 0)
      .sort((a, b) => a - b);
  };

  const handleSave = async () => {
    if (!settings) return;

    const minAmountNum = parseInt(minAmount, 10);
    if (isNaN(minAmountNum) || minAmountNum < 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Input',
        text2: 'Minimum withdrawal amount must be a valid positive number',
      });
      return;
    }

    const parsedAmounts = parseAmounts(amounts);
    if (parsedAmounts.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Input',
        text2: 'Please provide at least one withdrawal amount',
      });
      return;
    }

    // Check if minimum amount is in the list
    if (!parsedAmounts.includes(minAmountNum)) {
      Alert.alert(
        'Warning',
        `Minimum withdrawal amount (${formatCoins(minAmountNum)}) is not in the withdrawal amounts list. Do you want to add it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add It',
            onPress: () => {
              const updatedAmounts = [...parsedAmounts, minAmountNum].sort((a, b) => a - b);
              setAmounts(updatedAmounts.join(', '));
            },
          },
          {
            text: 'Save Anyway',
            onPress: async () => {
              await saveSettings(minAmountNum, parsedAmounts);
            },
          },
        ]
      );
      return;
    }

    const hasChanges =
      minAmountNum !== settings.minimumWithdrawalAmount ||
      JSON.stringify(parsedAmounts) !== JSON.stringify(settings.withdrawalAmounts);

    if (!hasChanges) {
      Toast.show({
        type: 'info',
        text1: 'No Changes',
        text2: 'No changes to save',
      });
      return;
    }

    Alert.alert(
      'Save Changes',
      'Are you sure you want to update the withdrawal settings? This will affect all users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            await saveSettings(minAmountNum, parsedAmounts);
          },
        },
      ]
    );
  };

  const saveSettings = async (minAmountNum: number, parsedAmounts: number[]) => {
    try {
      setIsSaving(true);
      await adminService.updateWithdrawalSettings({
        minimumWithdrawalAmount: minAmountNum,
        withdrawalAmounts: parsedAmounts,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Withdrawal settings updated successfully',
      });

      await loadSettings();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to update withdrawal settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!settings) return;
    Alert.alert(
      'Reset Changes',
      'Are you sure you want to reset all changes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            setMinAmount(settings.minimumWithdrawalAmount.toString());
            setAmounts(settings.withdrawalAmounts.join(', '));
          },
        },
      ]
    );
  };

  const handleAddQuickAmount = (amount: number) => {
    const parsedAmounts = parseAmounts(amounts);
    if (!parsedAmounts.includes(amount)) {
      const updatedAmounts = [...parsedAmounts, amount].sort((a, b) => a - b);
      setAmounts(updatedAmounts.join(', '));
    }
  };

  if (isLoading && !settings) {
    return <LoadingSpinner fullScreen />;
  }

  if (!settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.title}>Withdrawal Management</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  const parsedAmounts = parseAmounts(amounts);
  const minAmountNum = parseInt(minAmount, 10);
  const hasChanges =
    minAmountNum !== settings.minimumWithdrawalAmount ||
    JSON.stringify(parsedAmounts) !== JSON.stringify(settings.withdrawalAmounts);

  const quickAmounts = [100, 500, 1000, 2000, 5000, 10000];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Withdrawal Management</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Manage withdrawal settings. Users will see the minimum withdrawal amount and can choose from the available withdrawal amounts.
          </Text>
        </View>

        {/* Minimum Withdrawal Amount */}
        <View style={[styles.sectionCard, hasChanges && styles.sectionCardChanged]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash-outline" size={24} color="#007AFF" />
            <Text style={styles.sectionTitle}>Minimum Withdrawal Amount</Text>
          </View>
          <Text style={styles.sectionDescription}>
            The minimum amount users must have to request a withdrawal
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, hasChanges && styles.inputChanged]}
              value={minAmount}
              onChangeText={handleMinAmountChange}
              keyboardType="number-pad"
              placeholder="1000"
              placeholderTextColor="#8E8E93"
            />
            <Text style={styles.coinLabel}>coins</Text>
          </View>
          {hasChanges && minAmountNum !== settings.minimumWithdrawalAmount && (
            <View style={styles.diffContainer}>
              <Text style={styles.diffLabel}>Current:</Text>
              <Text style={styles.currentValue}>{formatCoins(settings.minimumWithdrawalAmount)}</Text>
              <Text style={styles.diffLabel}>New:</Text>
              <Text style={styles.newValue}>{formatCoins(minAmountNum)}</Text>
            </View>
          )}
        </View>

        {/* Withdrawal Amounts */}
        <View style={[styles.sectionCard, hasChanges && styles.sectionCardChanged]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={24} color="#007AFF" />
            <Text style={styles.sectionTitle}>Withdrawal Amounts</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Available withdrawal amounts users can choose from (comma-separated)
          </Text>
          <TextInput
            style={[styles.textArea, hasChanges && styles.inputChanged]}
            value={amounts}
            onChangeText={handleAmountsChange}
            placeholder="100, 500, 1000, 2000, 5000, 10000"
            placeholderTextColor="#8E8E93"
            multiline
            numberOfLines={3}
          />
          <View style={styles.quickAmountsContainer}>
            <Text style={styles.quickAmountsLabel}>Quick Add:</Text>
            <View style={styles.quickAmountsRow}>
              {quickAmounts.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.quickAmountButton,
                    parsedAmounts.includes(amount) && styles.quickAmountButtonActive,
                  ]}
                  onPress={() => handleAddQuickAmount(amount)}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      parsedAmounts.includes(amount) && styles.quickAmountTextActive,
                    ]}
                  >
                    {formatCoins(amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {parsedAmounts.length > 0 && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Preview:</Text>
              <View style={styles.previewRow}>
                {parsedAmounts.map((amount) => (
                  <View key={amount} style={styles.previewBadge}>
                    <Text style={styles.previewText}>{formatCoins(amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      {hasChanges && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            onPress={handleReset}
            style={styles.resetButton}
            disabled={isSaving}
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            disabled={isSaving}
          >
            <Text style={[styles.saveButtonText, isSaving && styles.saveButtonTextDisabled]}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
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
    marginTop: 20,
  },
  backButton: {
    padding: 4,
    marginTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 20,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sectionCardChanged: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F2F2F7',
  },
  inputChanged: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F2F2F7',
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  coinLabel: {
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 12,
    fontWeight: '500',
  },
  diffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  diffLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  currentValue: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 16,
    textDecorationLine: 'line-through',
  },
  newValue: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  quickAmountsContainer: {
    marginTop: 12,
  },
  quickAmountsLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  quickAmountButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  quickAmountText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  quickAmountTextActive: {
    color: '#FFFFFF',
  },
  previewContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  previewLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
  },
  previewText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
  },
});

export default AdminWithdrawalManagementScreen;
