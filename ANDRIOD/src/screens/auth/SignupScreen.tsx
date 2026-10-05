import React, { useState } from 'react';
import AuthLayout, { authStyles } from '@components/auth/AuthLayout';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@store/hooks';
import { signupUser } from '@store/slices/authSlice';
import { validation } from '@utils/validation';
import { ERROR_MESSAGES, ROUTES } from '@constants';
import Button from '@components/common/Button';
import Input from '@components/auth/AuthInput';
import Toast from 'react-native-toast-message';

const SignupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!validation.required(formData.name)) {
      newErrors.name = 'Name is required';
    }

    if (!validation.required(formData.username)) {
      newErrors.username = 'Username is required';
    }

    if (!validation.required(formData.email)) {
      newErrors.email = 'Email is required';
    } else if (!validation.email(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!validation.required(formData.password)) {
      newErrors.password = 'Password is required';
    } else if (!validation.password(formData.password)) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    try {
      await dispatch(
        signupUser({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          username: formData.username,
          referralCode: formData.referralCode || undefined,
        })
      ).unwrap();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Account created successfully! Please log in.',
      });
      navigation.replace('Login');
    } catch (error: any) {
      const errorMessage = error || ERROR_MESSAGES.USER_EXISTS;
      Toast.show({
        type: 'error',
        text1: 'Signup Failed',
        text2: errorMessage,
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout signup title="Create your account" subtitle="Get started with a few details. You’ll log in after signing up." loading={loading} onSwitch={() => navigation.navigate(ROUTES.LOGIN)}>
      <Input label="Full name" placeholder="Your full name" value={formData.name} onChangeText={text => setFormData({ ...formData, name: text })} autoComplete="name" autoCapitalize="words" error={errors.name} editable={!loading} />
      <Input label="Username" placeholder="Choose a username" value={formData.username} onChangeText={text => setFormData({ ...formData, username: text })} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" error={errors.username} editable={!loading} />
      <Input label="Email address" placeholder="you@example.com" value={formData.email} onChangeText={text => setFormData({ ...formData, email: text })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" error={errors.email} editable={!loading} />
      <Input label="Password" placeholder="At least 6 characters" value={formData.password} onChangeText={text => setFormData({ ...formData, password: text })} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" error={errors.password} editable={!loading} />
      <Input label="Confirm password" placeholder="Re-enter your password" value={formData.confirmPassword} onChangeText={text => setFormData({ ...formData, confirmPassword: text })} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" error={errors.confirmPassword} editable={!loading} />
      <Input label="Referral code · optional" placeholder="Have a code? Enter it here" value={formData.referralCode} onChangeText={text => setFormData({ ...formData, referralCode: text })} autoCapitalize="characters" autoCorrect={false} editable={!loading} returnKeyType="done" onSubmitEditing={handleSignup} />
      <Button title="Create account" onPress={handleSignup} loading={loading} style={authStyles.submit} />
    </AuthLayout>
  );
};

export default SignupScreen;

