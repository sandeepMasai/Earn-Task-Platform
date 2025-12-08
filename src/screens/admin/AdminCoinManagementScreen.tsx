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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminService, CoinConfig } from '@services/adminService';
import { formatCoins } from '@utils/validation';
import { ROUTES } from '../../constants/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const AdminCoinManagementScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [configs, setConfigs] = useState<CoinConfig[]>([]);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadConfigs = async () => {
    try {
      const data = await adminService.getCoinConfigs();
      setConfigs(data);
      // Initialize edited configs with current values
      const initialEdited: Record<string, number> = {};
      data.forEach((config) => {
        initialEdited[config.key] = config.value;
      });
      setEditedConfigs(initialEdited);
    } catch (error: any) {
      console.error('Error loading coin configs:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to load coin configurations',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadConfigs();
  };

  const handleValueChange = (key: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditedConfigs((prev) => ({
        ...prev,
        [key]: numValue,
      }));
    } else if (value === '') {
      setEditedConfigs((prev) => ({
        ...prev,
        [key]: 0,
      }));
    }
  };

  const handleSave = async () => {
    // Check if any values have changed
    const hasChanges = configs.some(
      (config) => editedConfigs[config.key] !== config.value
    );

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
      'Are you sure you want to update the coin values? This will affect all future transactions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              setIsSaving(true);
              const configsToUpdate = configs
                .filter((config) => editedConfigs[config.key] !== config.value)
                .map((config) => ({
                  key: config.key,
                  value: editedConfigs[config.key],
                }));

              await adminService.updateCoinConfigs(configsToUpdate);
              
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Coin values updated successfully',
              });
              
              // Reload configs to get updated data
              await loadConfigs();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error?.message || 'Failed to update coin values',
              });
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Changes',
      'Are you sure you want to reset all changes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            const resetValues: Record<string, number> = {};
            configs.forEach((config) => {
              resetValues[config.key] = config.value;
            });
            setEditedConfigs(resetValues);
          },
        },
      ]
    );
  };

  if (isLoading && configs.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  const hasChanges = configs.some(
    (config) => editedConfigs[config.key] !== config.value
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Coin Management</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Manage coin values for different actions. Changes will affect all future transactions.
          </Text>
        </View>

        {configs.map((config) => {
          const currentValue = config.value;
          const editedValue = editedConfigs[config.key] ?? currentValue;
          const hasChanged = editedValue !== currentValue;

          return (
            <View
              key={config.key}
              style={[styles.configCard, hasChanged && styles.configCardChanged]}
            >
              <View style={styles.configHeader}>
                <View style={styles.configInfo}>
                  <Text style={styles.configLabel}>{config.label}</Text>
                  {config.description && (
                    <Text style={styles.configDescription}>{config.description}</Text>
                  )}
                </View>
                {hasChanged && (
                  <View style={styles.changedBadge}>
                    <Text style={styles.changedBadgeText}>Changed</Text>
                  </View>
                )}
              </View>

              <View style={styles.configBody}>
                <View style={styles.valueContainer}>
                  <Text style={styles.valueLabel}>Current:</Text>
                  <Text style={styles.currentValue}>{formatCoins(currentValue)}</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>New Value:</Text>
                  <TextInput
                    style={[styles.input, hasChanged && styles.inputChanged]}
                    value={editedValue.toString()}
                    onChangeText={(value) => handleValueChange(config.key, value)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#8E8E93"
                  />
                  <Text style={styles.coinLabel}>coins</Text>
                </View>

                {hasChanged && (
                  <View style={styles.diffContainer}>
                    <Text style={styles.diffLabel}>Difference:</Text>
                    <Text
                      style={[
                        styles.diffValue,
                        editedValue > currentValue ? styles.diffValuePositive : styles.diffValueNegative,
                      ]}
                    >
                      {editedValue > currentValue ? '+' : ''}
                      {formatCoins(editedValue - currentValue)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
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
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Space for bottom buttons
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
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
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
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: '#FFFFFF',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  configCardChanged: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  configInfo: {
    flex: 1,
  },
  configLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  configDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  changedBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  configBody: {
    gap: 12,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  valueLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    minWidth: 80,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F5F5F5',
  },
  inputChanged: {
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
  },
  coinLabel: {
    fontSize: 14,
    color: '#8E8E93',
    minWidth: 50,
  },
  diffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  diffLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  diffValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  diffValuePositive: {
    color: '#34C759',
  },
  diffValueNegative: {
    color: '#FF3B30',
  },
});

export default AdminCoinManagementScreen;

