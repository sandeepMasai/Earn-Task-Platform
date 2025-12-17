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

const RefundPolicyScreen: React.FC = () => {
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
        <Text style={styles.title}>Refund / Payout Policy</Text>
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
          This Refund and Payout Policy outlines the terms and conditions governing withdrawals, refunds, and payouts on Earn Task Platform.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Withdrawal Process</Text>
          <Text style={styles.sectionText}>
            Users can withdraw their earned coins as cash through the following process:
          </Text>
          <Text style={styles.bulletPoint}>• Minimum withdrawal amount applies (as set by the platform)</Text>
          <Text style={styles.bulletPoint}>• Withdrawal requests must be submitted through the app</Text>
          <Text style={styles.bulletPoint}>• Users must provide accurate payment information (UPI, Bank Account, etc.)</Text>
          <Text style={styles.bulletPoint}>• Withdrawal requests are typically processed within 24-48 hours</Text>
          <Text style={styles.bulletPoint}>• Processing times may vary during holidays or high-volume periods</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Payment Methods</Text>
          <Text style={styles.sectionText}>
            We support the following payment methods for withdrawals:
          </Text>
          <Text style={styles.bulletPoint}>• UPI (Unified Payments Interface)</Text>
          <Text style={styles.bulletPoint}>• Bank Transfer</Text>
          <Text style={styles.bulletPoint}>• Paytm</Text>
          <Text style={styles.bulletPoint}>• PhonePe</Text>
          <Text style={styles.sectionText}>
            Additional payment methods may be added or removed at our discretion.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Withdrawal Fees</Text>
          <Text style={styles.sectionText}>
            Currently, we do not charge any fees for withdrawals. However, we reserve the right to implement withdrawal fees in the future with prior notice to users.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Withdrawal Rejection</Text>
          <Text style={styles.sectionText}>
            We reserve the right to reject withdrawal requests in the following circumstances:
          </Text>
          <Text style={styles.bulletPoint}>• Suspicious or fraudulent activity detected</Text>
          <Text style={styles.bulletPoint}>• Violation of platform terms and conditions</Text>
          <Text style={styles.bulletPoint}>• Incomplete or inaccurate payment information</Text>
          <Text style={styles.bulletPoint}>• Account under review or investigation</Text>
          <Text style={styles.bulletPoint}>• Failure to verify identity when requested</Text>
          <Text style={styles.sectionText}>
            If a withdrawal is rejected, coins will be returned to your account balance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Refund Policy</Text>
          <Text style={styles.sectionText}>
            Earn Task Platform operates on a task completion and reward system. The following refund policy applies:
          </Text>
          <Text style={styles.bulletPoint}>• Coins earned through task completion are non-refundable</Text>
          <Text style={styles.bulletPoint}>• If a task is incorrectly completed or rejected, coins may be deducted</Text>
          <Text style={styles.bulletPoint}>• We do not provide refunds for coins that have been withdrawn</Text>
          <Text style={styles.bulletPoint}>• In case of technical errors resulting in incorrect coin awards, we reserve the right to correct the balance</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Dispute Resolution</Text>
          <Text style={styles.sectionText}>
            If you have concerns about a withdrawal or payout:
          </Text>
          <Text style={styles.bulletPoint}>• Contact our support team through in-app channels</Text>
          <Text style={styles.bulletPoint}>• Provide transaction details and relevant information</Text>
          <Text style={styles.bulletPoint}>• We will investigate and respond within 5-7 business days</Text>
          <Text style={styles.bulletPoint}>• All disputes will be resolved in accordance with our Terms and Conditions</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Currency and Exchange Rates</Text>
          <Text style={styles.sectionText}>
            • Coins are converted to Indian Rupees (INR) at the rate of 100 coins = ₹1</Text>
          <Text style={styles.bulletPoint}>• Exchange rates are fixed and may not reflect real-time market rates</Text>
          <Text style={styles.bulletPoint}>• All payouts are processed in Indian Rupees</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Tax Obligations</Text>
          <Text style={styles.sectionText}>
            Users are responsible for any tax obligations related to their earnings and withdrawals. We recommend consulting with a tax professional regarding your specific situation.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Changes to Policy</Text>
          <Text style={styles.sectionText}>
            We reserve the right to modify this Refund and Payout Policy at any time. Users will be notified of significant changes. Continued use of the platform after changes constitutes acceptance of the updated policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Contact Support</Text>
          <Text style={styles.sectionText}>
            For questions or concerns about withdrawals or payouts, please contact us:
          </Text>
          <Text style={styles.bulletPoint}>• In-app support channels (Telegram, WhatsApp)</Text>
          <Text style={styles.bulletPoint}>• Email: support@earntaskplatform.com</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using Earn Task Platform, you acknowledge that you have read and understood this Refund and Payout Policy.
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

export default RefundPolicyScreen;
