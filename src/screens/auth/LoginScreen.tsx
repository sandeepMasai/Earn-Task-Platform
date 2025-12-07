import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@store/hooks';
import { loginUser } from '@store/slices/authSlice';
import { validation } from '@utils/validation';
import { ERROR_MESSAGES, ROUTES } from '@constants';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
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
        if (!validate()) return;

        setLoading(true);
        try {
            console.log('🔐 Login attempt started');
            const result = await dispatch(loginUser({ email, password })).unwrap();
            console.log('✅ Login successful:', result);
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Login successful!',
            });
            navigation.replace('MainTabs');
        } catch (error: any) {
            console.error('❌ Login failed:', error);
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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to continue</Text>
                </View>

                <View style={styles.form}>
                    <Input
                        label="Email"
                        placeholder="Enter your email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        error={errors.email}
                    />

                    <Input
                        label="Password"
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        error={errors.password}
                    />

                    <Button
                        title="Sign In"
                        onPress={handleLogin}
                        loading={loading}
                        style={styles.loginButton}
                    />

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <Text
                            style={styles.link}
                            onPress={() => navigation.navigate(ROUTES.SIGNUP)}
                        >
                            Sign Up
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
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#8E8E93',
    },
    form: {
        width: '100%',
    },
    loginButton: {
        marginTop: 8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    link: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '600',
    },
});

export default LoginScreen;

