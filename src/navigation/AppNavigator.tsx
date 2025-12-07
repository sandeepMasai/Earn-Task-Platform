import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { loadUser } from '@store/slices/authSlice';
import { RootStackParamList } from '@types';
import { ROUTES } from '@constants';

// Auth Screens
import SplashScreen from '@screens/auth/SplashScreen';
import OnboardingScreen from '@screens/auth/OnboardingScreen';
import LoginScreen from '@screens/auth/LoginScreen';
import SignupScreen from '@screens/auth/SignupScreen';
import InstagramIdScreen from '@screens/auth/InstagramIdScreen';

// Main Navigator
import MainTabsNavigator from './MainTabsNavigator';

// Stack Screens
import TaskDetailsScreen from '@screens/tasks/TaskDetailsScreen';
import VideoPlayerScreen from '@screens/tasks/VideoPlayerScreen';
import WithdrawScreen from '@screens/wallet/WithdrawScreen';
import UploadPostScreen from '@screens/feed/UploadPostScreen';

// Admin Screens
import AdminDashboardScreen from '@screens/admin/AdminDashboardScreen';
import AdminPaymentsScreen from '@screens/admin/AdminPaymentsScreen';
import AdminUsersScreen from '@screens/admin/AdminUsersScreen';
import AdminUserDetailsScreen from '@screens/admin/AdminUserDetailsScreen';

// Profile Screens
import WithdrawalHistoryScreen from '@screens/profile/WithdrawalHistoryScreen';
import EarningHistoryScreen from '@screens/profile/EarningHistoryScreen';
import ReferralsScreen from '@screens/profile/ReferralsScreen';

// Feed Screens
import CommentsScreen from '@screens/feed/CommentsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
    const dispatch = useAppDispatch();
    const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

    useEffect(() => {
        dispatch(loadUser());
    }, [dispatch]);

    return (
        <NavigationContainer>
            <Stack.Navigator 
                screenOptions={{ headerShown: false }}
                initialRouteName={ROUTES.SPLASH}
            >
                <Stack.Screen name={ROUTES.SPLASH} component={SplashScreen} />
                {!isAuthenticated ? (
                    <>
                        <Stack.Screen name={ROUTES.ONBOARDING} component={OnboardingScreen} />
                        <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
                        <Stack.Screen name={ROUTES.SIGNUP} component={SignupScreen} />
                        <Stack.Screen name={ROUTES.INSTAGRAM_ID} component={InstagramIdScreen} />
                    </>
                ) : (
                    <>
                        <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
                        <Stack.Screen
                            name={ROUTES.TASK_DETAILS}
                            component={TaskDetailsScreen}
                            options={{ headerShown: true, title: 'Task Details' }}
                        />
                        <Stack.Screen
                            name={ROUTES.VIDEO_PLAYER}
                            component={VideoPlayerScreen}
                            options={{ headerShown: true, title: 'Watch Video' }}
                        />
                        <Stack.Screen
                            name={ROUTES.WITHDRAW}
                            component={WithdrawScreen}
                            options={{ headerShown: true, title: 'Withdraw' }}
                        />
                        <Stack.Screen
                            name={ROUTES.UPLOAD_POST}
                            component={UploadPostScreen}
                            options={{ headerShown: true, title: 'Upload Post' }}
                        />
                        <Stack.Screen
                            name={ROUTES.ADMIN_DASHBOARD}
                            component={AdminDashboardScreen}
                            options={{ headerShown: true, title: 'Admin Dashboard' }}
                        />
                        <Stack.Screen
                            name={ROUTES.ADMIN_PAYMENTS}
                            component={AdminPaymentsScreen}
                            options={{ headerShown: true, title: 'Payment Requests' }}
                        />
                        <Stack.Screen
                            name={ROUTES.ADMIN_USERS}
                            component={AdminUsersScreen}
                            options={{ headerShown: true, title: 'Users' }}
                        />
                        <Stack.Screen
                            name={ROUTES.ADMIN_USER_DETAILS}
                            component={AdminUserDetailsScreen}
                            options={{ headerShown: true, title: 'User Details' }}
                        />
                        <Stack.Screen
                            name={ROUTES.WITHDRAWAL_HISTORY}
                            component={WithdrawalHistoryScreen}
                            options={{ headerShown: true, title: 'Withdrawal History' }}
                        />
                        <Stack.Screen
                            name={ROUTES.EARNING_HISTORY}
                            component={EarningHistoryScreen}
                            options={{ headerShown: true, title: 'Earning History' }}
                        />
                        <Stack.Screen
                            name={ROUTES.REFERRALS}
                            component={ReferralsScreen}
                            options={{ headerShown: true, title: 'My Referrals' }}
                        />
                        <Stack.Screen
                            name={ROUTES.COMMENTS}
                            component={CommentsScreen}
                            options={{ headerShown: false }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;

