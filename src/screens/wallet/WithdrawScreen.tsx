import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { requestWithdrawal } from '@store/slices/walletSlice';
import { formatCoins, formatCurrency, coinsToRupees } from '@utils/validation';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, MIN_WITHDRAWAL_AMOUNT } from '@constants';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import Toast from 'react-native-toast-message';
import { TouchableOpacity } from 'react-native';

const WithdrawScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { balance } = useAppSelector((state) => state.wallet);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [accountDetails, setAccountDetails] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const maxAmount = balance;
  const rupeesValue = amount ? coinsToRupees(parseFloat(amount) || 0) : 0;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (amountNum < MIN_WITHDRAWAL_AMOUNT) {
      newErrors.amount = `Minimum withdrawal is ${formatCoins(MIN_WITHDRAWAL_AMOUNT)}`;
    } else if (amountNum > balance) {
      newErrors.amount = 'Insufficient balance';
    }

    if (!accountDetails.trim()) {
      newErrors.accountDetails = 'Account details are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleWithdraw = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await dispatch(
        requestWithdrawal({
          amount: parseFloat(amount),
          paymentMethod,
          accountDetails,
        })
      ).unwrap();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: SUCCESS_MESSAGES.WITHDRAWAL_REQUESTED,
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error || 'Failed to request withdrawal',
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
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{formatCoins(balance)}</Text>
          <Text style={styles.balanceRupees}>≈ {formatCurrency(coinsToRupees(balance))}</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Withdrawal Amount (Coins)"
            placeholder={`Min: ${formatCoins(MIN_WITHDRAWAL_AMOUNT)}`}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            error={errors.amount}
            containerStyle={styles.inputContainer}
          />

          {amount && !errors.amount && (
            <View style={styles.amountInfo}>
              <Text style={styles.amountInfoText}>
                You will receive: {formatCurrency(rupeesValue)}
              </Text>
            </View>
          )}

          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodContainer}>
              {['UPI', 'Bank Transfer', 'Paytm', 'PhonePe'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.methodOption,
                    paymentMethod === method && styles.methodOptionActive,
                  ]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text
                    style={[
                      styles.methodText,
                      paymentMethod === method && styles.methodTextActive,
                    ]}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label={
              paymentMethod === 'UPI'
                ? 'UPI ID'
                : paymentMethod === 'Bank Transfer'
                ? 'Account Number & IFSC'
                : 'Account Details'
            }
            placeholder={
              paymentMethod === 'UPI'
                ? 'yourname@upi'
                : paymentMethod === 'Bank Transfer'
                ? 'Account Number, IFSC Code'
                : 'Enter account details'
            }
            value={accountDetails}
            onChangeText={setAccountDetails}
            error={errors.accountDetails}
            containerStyle={styles.inputContainer}
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              • Minimum withdrawal: {formatCoins(MIN_WITHDRAWAL_AMOUNT)}
            </Text>
            <Text style={styles.infoText}>
              • Withdrawal requests are processed within 24-48 hours
            </Text>
            <Text style={styles.infoText}>
              • Conversion rate: 100 coins = ₹1
            </Text>
          </View>

          <Button
            title="Request Withdrawal"
            onPress={handleWithdraw}
            loading={loading}
            style={styles.withdrawButton}
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
    padding: 20,
  },
  balanceInfo: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  balanceRupees: {
    fontSize: 16,
    color: '#8E8E93',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  amountInfo: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  amountInfoText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  methodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 8,
  },
  methodOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF20',
  },
  methodText: {
    fontSize: 14,
    color: '#000000',
  },
  methodTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
    lineHeight: 18,
  },
  withdrawButton: {
    marginTop: 8,
  },
});

export default WithdrawScreen;

