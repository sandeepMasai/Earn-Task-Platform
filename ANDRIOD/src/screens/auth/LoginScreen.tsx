import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import AuthLayout, { authStyles } from '@components/auth/AuthLayout';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@store/hooks';
import { loginUser } from '@store/slices/authSlice';
import { validation } from '@utils/validation';
import { ERROR_MESSAGES, ROUTES } from '@constants';
import Button from '@components/common/Button';
import Input from '@components/auth/AuthInput';
import Toast from 'react-native-toast-message';

const LoginScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const dispatch = useAppDispatch();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
    const [loading, setLoading] = useState(false);

    const validate = (): boolean => {
        const newErrors: { email?: string; password?: string } = {};

        if (!validation.required(email)) {
            newErrors.email = 'Email is required';
        } else if (!validation.email(email)) {
            newErrors.email = 'Invalid email format';
        }

        if (!validation.required(password)) {
            newErrors.password = 'Password is required';
        } else if (!validation.password(password)) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (loading || !validate()) return;

        setLoading(true);
        try {
            await dispatch(loginUser({ email, password })).unwrap();
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Login successful!',
            });
            navigation.replace('MainTabs');
        } catch (error: any) {
            const errorMessage = error || ERROR_MESSAGES.INVALID_CREDENTIALS;
            Toast.show({
                type: 'error',
                text1: 'Login Failed',
                text2: errorMessage,
                visibilityTime: 4000,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Welcome back" subtitle="Log in to pick up where you left off." loading={loading} onSwitch={() => navigation.navigate(ROUTES.SIGNUP)}>
            <Input label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" error={errors.email} editable={!loading} />
            <Input label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" error={errors.password} editable={!loading} returnKeyType="go" onSubmitEditing={handleLogin} />
            <Pressable accessibilityRole="button" accessibilityLabel="Forgot password" disabled={loading} onPress={() => navigation.navigate(ROUTES.FORGOT_PASSWORD)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 8 }}>
                <Text style={{ color: '#176B54', fontWeight: '700', fontSize: 14 }}>Forgot password?</Text>
            </Pressable>
            <Button title="Log in" onPress={handleLogin} loading={loading} style={authStyles.submit} />
        </AuthLayout>
    );
};

export default LoginScreen;

