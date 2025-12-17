import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@store/hooks';
import { updateInstagramId } from '@store/slices/authSlice';
import { validation } from '@utils/validation';
import { ROUTES } from '@constants';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import Toast from 'react-native-toast-message';

const InstagramIdScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const dispatch = useAppDispatch();
    const [instagramId, setInstagramId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!validation.required(instagramId)) {
            setError('Instagram ID is required');
            return;
        }

        if (!validation.instagramId(instagramId)) {
            setError('Invalid Instagram ID format');
            return;
        }

        setError('');
        setLoading(true);
        try {
            await dispatch(updateInstagramId(instagramId)).unwrap();
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Instagram ID added successfully!',
            });
            navigation.replace('MainTabs');
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error || 'Failed to update Instagram ID',
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
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Add Instagram ID</Text>
                    <Text style={styles.subtitle}>
                        Add your Instagram username to complete tasks and earn more coins
                    </Text>
                </View>

                <View style={styles.form}>
                    <Input
                        label="Instagram Username"
                        placeholder="Enter your Instagram username"
                        value={instagramId}
                        onChangeText={(text) => {
                            setInstagramId(text.replace('@', ''));
                            setError('');
                        }}
                        autoCapitalize="none"
                        error={error}
                        containerStyle={styles.inputContainer}
                    />

                    <Text style={styles.hint}>
                        Example: If your Instagram is @username, enter "username"
                    </Text>

                    <Button
                        title="Continue"
                        onPress={handleSubmit}
                        loading={loading}
                        style={styles.button}
                    />

                    <Text
                        style={styles.skip}
                        onPress={() => navigation.replace('MainTabs')}
                    >
                        Skip for now
                    </Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 12,
        marginTop: 20,
    },
    subtitle: {
        fontSize: 16,
        color: '#8E8E93',
        lineHeight: 24,
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        marginBottom: 12,
    },
    hint: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 24,
        fontStyle: 'italic',
    },
    button: {
        marginBottom: 16,
    },
    skip: {
        fontSize: 14,
        color: '#007AFF',
        textAlign: 'center',
        fontWeight: '600',
    },
});

export default InstagramIdScreen;

