import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { loadUser } from '@store/slices/authSlice';
import { onboardingStorage } from '@utils/storage';
import { ROUTES } from '@constants';
import LoadingSpinner from '@components/common/LoadingSpinner';

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { isLoading, isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await dispatch(loadUser());
      } catch (error) {
        console.log('Error loading user:', error);
      }
    };

    initializeApp();
  }, [dispatch]);

  useEffect(() => {
    // Only navigate after loading is complete
    if (!isLoading) {
      const navigateToScreen = async () => {
        // Wait a bit for navigation to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          if (isAuthenticated) {
            navigation.replace('MainTabs');
          } else {
            const onboardingComplete = await onboardingStorage.isComplete();
            if (onboardingComplete) {
              // Use a small delay to ensure Login screen is registered
              setTimeout(() => {
                try {
                  navigation.replace(ROUTES.LOGIN);
                } catch (error) {
                  // If Login screen not available, go to onboarding
                  console.log('Login screen not available, going to onboarding');
                  navigation.replace(ROUTES.ONBOARDING);
                }
              }, 200);
            } else {
              navigation.replace(ROUTES.ONBOARDING);
            }
          }
        } catch (error) {
          console.log('Navigation error:', error);
          // Fallback - navigate to onboarding
          try {
            navigation.replace(ROUTES.ONBOARDING);
          } catch (fallbackError) {
            console.log('Fallback navigation error:', fallbackError);
          }
        }
      };

      navigateToScreen();
    }
  }, [isLoading, isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>💰</Text>
      </View>
      <Text style={styles.title}>Earn Task Platform</Text>
      <Text style={styles.subtitle}>Earn rewards by completing tasks</Text>
      <LoadingSpinner size="large" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 40,
  },
  spinner: {
    marginTop: 20,
  },
});

export default SplashScreen;

