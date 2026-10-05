import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

type Step = 'email' | 'otp' | 'password' | 'success';
type Errors = { email?: string; code?: string; newPassword?: string; confirmPassword?: string };

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [cooldown, setCooldown] = useState(0);

  const busy = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
      const resp = (error as { response?: { data?: { error?: string } } }).response;
      if (resp?.data?.error) return resp.data.error;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  };

  const handleSendEmail = async () => {
    if (busy.current) return;
    const trimmed = email.trim();
    if (!validation.required(trimmed)) {
      setErrors({ email: 'Email is required' });
      return;
    }
    if (!validation.email(trimmed)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    busy.current = true;
    setLoading(true);
    setErrors({});
    try {
      await authService.forgotPassword(trimmed);
      startCooldown();
      setStep('otp');
      Toast.show({
        type: 'success',
        text1: 'Verification code sent',
        text2: 'If an active account exists, a 6-digit code has been sent.',
      });
    } catch (error) {
      const msg = getErrorMessage(error, 'Unable to send reset code. Please try again.');
      Toast.show({ type: 'error', text1: 'Request failed', text2: msg });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (busy.current || cooldown > 0) return;
    busy.current = true;
    setLoading(true);
    try {
      setResetToken('');
      await authService.forgotPassword(email.trim());
      startCooldown();
      Toast.show({
        type: 'success',
        text1: 'Code resent',
        text2: 'Check your inbox and spam folder.',
      });
    } catch (error) {
      const msg = getErrorMessage(error, 'Unable to resend code. Please try again.');
      Toast.show({ type: 'error', text1: 'Resend failed', text2: msg });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (busy.current) return;
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setErrors({ code: 'Please enter the 6-digit code' });
      return;
    }
    if (!/^\d{6}$/.test(trimmedCode)) {
      setErrors({ code: 'Enter a valid 6-digit verification code' });
      return;
    }

    busy.current = true;
    setLoading(true);
    setErrors({});
    try {
      const res = await authService.verifyOtp(email.trim(), trimmedCode);
      if (res?.resetToken) {
        setResetToken(res.resetToken);
        navigation.navigate(ROUTES.RESET_PASSWORD, {
          email: email.trim(),
          resetToken: res.resetToken,
        });
      }
      setStep('password');
      Toast.show({
        type: 'success',
        text1: 'Code verified',
        text2: 'Please create a new password.',
      });
    } catch (error) {
      const msg = getErrorMessage(error, 'Invalid or expired code. Please try again.');
      setErrors({ code: msg });
      Toast.show({ type: 'error', text1: 'Verification failed', text2: msg });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (busy.current) return;

    if (!resetToken) {
      Toast.show({
        type: 'error',
        text1: 'Verification expired',
        text2: 'Please request a new OTP.',
      });
      setStep('email');
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
      nextErrors.confirmPassword = 'Confirm your password';
    } else if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    busy.current = true;
    setLoading(true);
    try {
      await authService.resetPassword(email.trim(), resetToken, newPassword);
      // Clean up sensitive fields
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setResetToken('');
      setStep('success');
      Toast.show({
        type: 'success',
        text1: 'Password reset successful',
        text2: 'You can now log in with your new password.',
      });
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to reset password. Please try again.');
      Toast.show({ type: 'error', text1: 'Reset failed', text2: msg });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'email':
        return 'Forgot password?';
      case 'otp':
        return 'Verify reset code';
      case 'password':
        return 'Set new password';
      case 'success':
        return 'Password updated';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'email':
        return 'Enter your account email to receive a 6-digit reset code.';
      case 'otp':
        return `Enter the 6-digit code sent to ${email}. Codes expire in 10 minutes.`;
      case 'password':
        return 'Choose a strong password with at least 6 characters.';
      case 'success':
        return 'Your password has been changed successfully. You may now log in.';
    }
  };

  return (
    <AuthLayout
      recovery
      title={getStepTitle()}
      subtitle={getStepSubtitle()}
      loading={loading}
      onSwitch={() => navigation.replace(ROUTES.LOGIN)}
    >
      {step === 'email' && (
        <>
          <Input
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            error={errors.email}
            returnKeyType="go"
            onSubmitEditing={handleSendEmail}
          />
          <Button
            title="Send reset code"
            onPress={handleSendEmail}
            loading={loading}
            style={authStyles.submit}
          />
        </>
      )}

      {step === 'otp' && (
        <>
          <Text style={authStyles.hint}>
            Check your inbox and spam folder. If no email arrives, verify your address or resend
            after cooldown.
          </Text>
          <Input
            label="6-Digit Reset Code"
            placeholder="000000"
            value={code}
            onChangeText={(val) => {
              setCode(val);
              if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
            }}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            editable={!loading}
            error={errors.code}
            returnKeyType="done"
            onSubmitEditing={handleVerifyOtp}
          />
          <Button
            title="Verify code"
            onPress={handleVerifyOtp}
            loading={loading}
            style={authStyles.submit}
          />
          <View style={localStyles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cooldown > 0 ? `Resend code in ${cooldown} seconds` : 'Resend code'}
              disabled={loading || cooldown > 0}
              onPress={handleResendCode}
              style={localStyles.actionLink}
            >
              <Text
                style={[
                  localStyles.primaryLinkText,
                  (cooldown > 0 || loading) && localStyles.disabledLinkText,
                ]}
              >
                {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use a different email address"
              disabled={loading}
              onPress={() => {
                setStep('email');
                setCode('');
                setResetToken('');
                setErrors({});
              }}
              style={localStyles.actionLink}
            >
              <Text style={localStyles.secondaryLinkText}>Change email</Text>
            </Pressable>
          </View>
        </>
      )}

      {step === 'password' && (
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
      )}

      {step === 'success' && (
        <View style={localStyles.successContainer}>
          <View style={localStyles.successIconCircle}>
            <Ionicons name="checkmark-circle" size={54} color="#176B54" />
          </View>
          <Text style={localStyles.successText}>
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

const localStyles = StyleSheet.create({
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  actionLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryLinkText: {
    color: '#176B54',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryLinkText: {
    color: '#53645E',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledLinkText: {
    color: '#9CAAA4',
  },
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
