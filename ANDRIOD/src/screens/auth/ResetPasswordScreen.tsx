import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@types';
import AuthLayout, { authStyles } from '@components/auth/AuthLayout';
import Input from '@components/auth/AuthInput';
import Button from '@components/common/Button';
import { authService } from '@services/authService';
import { validation } from '@utils/validation';
import { ROUTES } from '@constants';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

type Errors = { newPassword?: string; confirmPassword?: string };

export default function ResetPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>();
  const { email = '', resetToken = '' } = route.params || {};

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const busy = useRef(false);

  useEffect(() => {
    if (!resetToken) {
      Toast.show({
        type: 'error',
        text1: 'Verification expired',
        text2: 'Please request a new OTP.',
      });
      navigation.replace(ROUTES.FORGOT_PASSWORD, { email });
    }
  }, [resetToken, email, navigation]);

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
      const resp = (error as { response?: { data?: { error?: string } } }).response;
      if (resp?.data?.error) return resp.data.error;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  };

  const handleResetPassword = async () => {
    if (busy.current) return;

    if (!resetToken) {
      Toast.show({
        type: 'error',
        text1: 'Verification expired',
        text2: 'Please request a new OTP.',
      });
      navigation.replace(ROUTES.FORGOT_PASSWORD, { email });
      return;
    }

    const nextErrors: Errors = {};
    if (!validation.required(newPassword)) {
      nextErrors.newPassword = 'New password is required';
    } else if (!validation.password(newPassword)) {
      nextErrors.newPassword = 'Password must be at least 6 characters';
    } else if (newPassword.length > 72) {
      nextErrors.newPassword = 'Password cannot exceed 72 characters';
    }

    if (!validation.required(confirmPassword)) {
      nextErrors.confirmPassword = 'Confirm your new password';
    } else if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    busy.current = true;
    setLoading(true);
    try {
      await authService.resetPassword(email.trim(), resetToken, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      Toast.show({
        type: 'success',
        text1: 'Password reset successful',
        text2: 'Please log in with your new password.',
      });
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to reset password. Please try again.');
      Toast.show({ type: 'error', text1: 'Reset failed', text2: msg });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      recovery
      title={success ? 'Password updated' : 'Set new password'}
      subtitle={
        success
          ? 'Your password has been changed successfully. You may now log in.'
          : 'Choose a strong password with at least 6 characters.'
      }
      loading={loading}
      onSwitch={() => navigation.replace(ROUTES.LOGIN)}
    >
      {!success ? (
        <>
          <Input
            label="New password"
            placeholder="At least 6 characters"
            value={newPassword}
            onChangeText={(val) => {
              setNewPassword(val);
              if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: undefined }));
            }}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.newPassword}
            editable={!loading}
          />
          <Input
            label="Confirm new password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChangeText={(val) => {
              setConfirmPassword(val);
              if (errors.confirmPassword)
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.confirmPassword}
            editable={!loading}
            returnKeyType="go"
            onSubmitEditing={handleResetPassword}
          />
          <Button
            title="Reset password"
            onPress={handleResetPassword}
            loading={loading}
            style={authStyles.submit}
          />
        </>
      ) : (
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark-circle" size={54} color="#176B54" />
          </View>
          <Text style={styles.successText}>
            Your password has been successfully reset. Please log in with your new credentials.
          </Text>
          <Button
            title="Go to Login"
            onPress={() => navigation.replace(ROUTES.LOGIN)}
            style={authStyles.submit}
          />
        </View>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  successContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconCircle: {
    marginBottom: 16,
  },
  successText: {
    color: '#162D25',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
});
