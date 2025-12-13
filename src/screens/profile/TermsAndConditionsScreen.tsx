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

const TermsAndConditionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>Terms & Conditions</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.lastUpdated}>
          Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>

        <Text style={styles.intro}>
          Welcome to Earn Task Platform. By accessing or using our mobile application and services, you agree to be bound by these Terms and Conditions. Please read them carefully.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.sectionText}>
            By creating an account, accessing, or using Earn Task Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, you may not use our services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Eligibility</Text>
          <Text style={styles.sectionText}>You must meet the following criteria to use our platform:</Text>
          <Text style={styles.bulletPoint}>• You must be at least 13 years of age</Text>
          <Text style={styles.bulletPoint}>• You must have the legal capacity to enter into binding agreements</Text>
          <Text style={styles.bulletPoint}>• You must provide accurate and complete information when registering</Text>
          <Text style={styles.bulletPoint}>• You must comply with all applicable laws and regulations</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Account Registration</Text>
          <Text style={styles.sectionText}>
            When you create an account, you agree to:
          </Text>
          <Text style={styles.bulletPoint}>• Provide accurate, current, and complete information</Text>
          <Text style={styles.bulletPoint}>• Maintain and update your information to keep it accurate</Text>
          <Text style={styles.bulletPoint}>• Maintain the security of your account credentials</Text>
          <Text style={styles.bulletPoint}>• Accept responsibility for all activities under your account</Text>
          <Text style={styles.bulletPoint}>• Notify us immediately of any unauthorized use</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Task Completion and Rewards</Text>
          <Text style={styles.sectionText}>
            Our platform allows users to complete tasks and earn coins:
          </Text>
          <Text style={styles.bulletPoint}>• Tasks must be completed according to their specific requirements</Text>
          <Text style={styles.bulletPoint}>• We reserve the right to verify task completion before awarding coins</Text>
          <Text style={styles.bulletPoint}>• Coins are awarded at our discretion and may be revoked for fraudulent activity</Text>
          <Text style={styles.bulletPoint}>• Task requirements and coin values may change without prior notice</Text>
          <Text style={styles.bulletPoint}>• We reserve the right to reject task submissions that do not meet requirements</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Withdrawals and Payments</Text>
          <Text style={styles.sectionText}>
            Withdrawal of coins is subject to the following terms:
          </Text>
          <Text style={styles.bulletPoint}>• Minimum withdrawal amounts apply as set by the platform</Text>
          <Text style={styles.bulletPoint}>• Withdrawal requests are processed within 24-48 hours</Text>
          <Text style={styles.bulletPoint}>• You must provide accurate payment information</Text>
          <Text style={styles.bulletPoint}>• We reserve the right to verify your identity before processing withdrawals</Text>
          <Text style={styles.bulletPoint}>• Withdrawals may be delayed or rejected for security or compliance reasons</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. User Conduct</Text>
          <Text style={styles.sectionText}>You agree not to:</Text>
          <Text style={styles.bulletPoint}>• Use the platform for any illegal or unauthorized purpose</Text>
          <Text style={styles.bulletPoint}>• Violate any laws or regulations</Text>
          <Text style={styles.bulletPoint}>• Create fake accounts or use multiple accounts to exploit the system</Text>
          <Text style={styles.bulletPoint}>• Submit false or misleading information</Text>
          <Text style={styles.bulletPoint}>• Interfere with or disrupt the platform's operation</Text>
          <Text style={styles.bulletPoint}>• Attempt to gain unauthorized access to any part of the platform</Text>
          <Text style={styles.bulletPoint}>• Use automated systems or bots to complete tasks</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Content and Intellectual Property</Text>
          <Text style={styles.sectionText}>
            All content on the platform, including text, graphics, logos, and software, is the property of Earn Task Platform or its licensors and is protected by copyright and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our written permission.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Termination</Text>
          <Text style={styles.sectionText}>
            We reserve the right to suspend or terminate your account at any time, with or without notice, for:
          </Text>
          <Text style={styles.bulletPoint}>• Violation of these Terms and Conditions</Text>
          <Text style={styles.bulletPoint}>• Fraudulent or suspicious activity</Text>
          <Text style={styles.bulletPoint}>• Failure to comply with platform rules</Text>
          <Text style={styles.bulletPoint}>• Any other reason we deem necessary</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
          <Text style={styles.sectionText}>
            Earn Task Platform shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or use, incurred by you or any third party, whether in an action in contract or tort, arising from your use of the platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
          <Text style={styles.sectionText}>
            We reserve the right to modify these Terms and Conditions at any time. We will notify users of significant changes. Your continued use of the platform after changes constitutes acceptance of the new terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact Information</Text>
          <Text style={styles.sectionText}>
            If you have questions about these Terms and Conditions, please contact us through:
          </Text>
          <Text style={styles.bulletPoint}>• In-app support channels</Text>
          <Text style={styles.bulletPoint}>• Email: support@earntaskplatform.com</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using Earn Task Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
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
  },
  lastUpdated: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  intro: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
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
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TermsAndConditionsScreen;
