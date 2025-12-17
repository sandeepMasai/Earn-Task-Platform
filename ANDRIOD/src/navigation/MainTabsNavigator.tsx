import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '@types';
import { ROUTES } from '@constants';
import { Ionicons } from '@expo/vector-icons';

// Tab Screens
import HomeScreen from '@screens/home/HomeScreen';
import EarnScreen from '@screens/earn/EarnScreen';
import FeedScreen from '@screens/feed/FeedScreen';
import WalletScreen from '@screens/wallet/WalletScreen';
import ProfileScreen from '@screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabsNavigator: React.FC = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap;

                    if (route.name === ROUTES.HOME_TAB) {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === ROUTES.EARN_TAB) {
                        iconName = focused ? 'cash' : 'cash-outline';
                    } else if (route.name === ROUTES.FEED_TAB) {
                        iconName = focused ? 'images' : 'images-outline';
                    } else if (route.name === ROUTES.WALLET_TAB) {
                        iconName = focused ? 'wallet' : 'wallet-outline';
                    } else {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#007AFF',
                tabBarInactiveTintColor: '#8E8E93',
                headerShown: true,
            })}
        >
            <Tab.Screen
                name={ROUTES.HOME_TAB}
                component={HomeScreen}
                options={{ title: 'Home' }}
            />
            <Tab.Screen
                name={ROUTES.EARN_TAB}
                component={EarnScreen}
                options={{ title: 'Earn' }}
            />
            <Tab.Screen
                name={ROUTES.FEED_TAB}
                component={FeedScreen}
                options={{ title: 'Feed' }}
            />
            <Tab.Screen
                name={ROUTES.WALLET_TAB}
                component={WalletScreen}
                options={{ title: 'Wallet' }}
            />
            <Tab.Screen
                name={ROUTES.PROFILE_TAB}
                component={ProfileScreen}
                options={{ title: 'Profile' }}
            />
        </Tab.Navigator>
    );
};

export default MainTabsNavigator;

