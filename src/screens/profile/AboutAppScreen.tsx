import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const AboutAppScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const appVersion = Constants.expoConfig?.version || (Constants.manifest as any)?.version || '1.0.0';
  const appName = Constants.expoConfig?.name || (Constants.manifest as any)?.name || 'Earn Task Platform';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>About App</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.logoContainer}>
          <Ionicons name="cash" size={64} color="#007AFF" />
        </View>

        <Text style={styles.appName}>{appName}</Text>
        <Text style={styles.version}>Version {appVersion}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionText}>
            Earn Task Platform is a mobile application that allows users to earn coins by completing various tasks such as watching videos, following social media accounts, liking posts, and more. Users can then withdraw their earned coins as real money.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <Text style={styles.bulletPoint}>• Complete tasks and earn coins</Text>
          <Text style={styles.bulletPoint}>• Withdraw earnings to your bank account or UPI</Text>
          <Text style={styles.bulletPoint}>• Share posts and interact with the community</Text>
          <Text style={styles.bulletPoint}>• Refer friends and earn bonus coins</Text>
          <Text style={styles.bulletPoint}>• Become a creator and create your own tasks</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <Text style={styles.sectionText}>
            1. Browse available tasks in the Earn section{'\n'}
            2. Complete tasks according to their requirements{'\n'}
            3. Earn coins for each completed task{'\n'}
            4. Accumulate coins in your wallet{'\n'}
            5. Withdraw your earnings when you reach the minimum amount
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact & Support</Text>
          <Text style={styles.sectionText}>
            For support, questions, or feedback, please contact us:
          </Text>
          <Text style={styles.bulletPoint}>• In-app support channels (Telegram, WhatsApp)</Text>
          <Text style={styles.bulletPoint}>• Email: support@earntaskplatform.com</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <Text style={styles.sectionText}>
            Please review our Terms & Conditions, Privacy Policy, and Community Guidelines to understand your rights and responsibilities when using the app.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Earn Task Platform. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  version: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 32,
  },
  section: {
    width: '100%',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
    marginLeft: 16,
    marginBottom: 8,
  },
  footer: {
    marginTop: 32,
    padding: 16,
    width: '100%',
  },
  footerText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default AboutAppScreen;
