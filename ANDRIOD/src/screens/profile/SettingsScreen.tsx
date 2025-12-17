import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { logoutUser } from '@store/slices/authSlice';
import { ROUTES } from '@constants';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await dispatch(logoutUser());
            navigation.reset({
              index: 0,
              routes: [{ name: ROUTES.LOGIN }],
            });
          },
        },
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version || (Constants.manifest as any)?.version || '1.0.0';

  const accountSection = [
    {
      icon: 'person-outline',
      title: 'Edit Profile',
      onPress: () => navigation.navigate(ROUTES.EDIT_PROFILE),
    },
  ];

  const creatorSection = [
    {
      icon: 'star-outline',
      title: 'Become a Creator',
      onPress: () => navigation.navigate(ROUTES.CREATOR_REGISTER),
      color: '#FF9500',
    },
    {
      icon: 'time-outline',
      title: 'My Creator Request',
      onPress: () => navigation.navigate(ROUTES.CREATOR_REQUEST_HISTORY),
    },
  ];

  const legalSection = [
    {
      icon: 'document-text-outline',
      title: 'Terms & Conditions',
      onPress: () => navigation.navigate(ROUTES.TERMS_AND_CONDITIONS),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy Policy',
      onPress: () => navigation.navigate(ROUTES.PRIVACY_POLICY),
    },
    {
      icon: 'cash-outline',
      title: 'Refund / Payout Policy',
      onPress: () => navigation.navigate(ROUTES.REFUND_POLICY),
    },
    {
      icon: 'people-outline',
      title: 'Community Guidelines',
      onPress: () => navigation.navigate(ROUTES.COMMUNITY_GUIDELINES),
    },
  ];

  const aboutSection = [
    {
      icon: 'information-circle-outline',
      title: 'About App',
      onPress: () => navigation.navigate(ROUTES.ABOUT_APP),
    },
  ];

  const renderSection = (title: string, items: any[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuItem,
              index === items.length - 1 && styles.menuItemLast,
            ]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.icon as any}
              size={24}
              color={item.color || '#000000'}
            />
            <Text style={[styles.menuText, item.color ? { color: item.color } : null]}>
              {item.title}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderSection('Account', accountSection)}
        {renderSection('Creator', creatorSection)}
        {renderSection('Legal', legalSection)}
        {renderSection('About', aboutSection)}

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>App Version {appVersion}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
    marginTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
    marginTop: 20,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    marginLeft: 12,
  },
  logoutSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  versionText: {
    fontSize: 12,
    color: '#8E8E93',
  },
});

export default SettingsScreen;
