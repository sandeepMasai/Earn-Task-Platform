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

const PrivacyPolicyScreen: React.FC = () => {
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
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

        <Text style={styles.intro}>
          At Earn Task Platform, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.sectionText}>
            We collect information that you provide directly to us, including:
          </Text>
          <Text style={styles.bulletPoint}>
            • Personal Information: Name, email address, username, and profile picture
          </Text>
          <Text style={styles.bulletPoint}>
            • Account Information: Instagram ID, YouTube channel information (for creators)
          </Text>
          <Text style={styles.bulletPoint}>
            • Financial Information: Wallet balance, transaction history, withdrawal requests
          </Text>
          <Text style={styles.bulletPoint}>
            • Task Data: Task completions, submissions, proof images/videos
          </Text>
          <Text style={styles.bulletPoint}>
            • Content: Posts, comments, and other content you create on the platform
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.sectionText}>We use the information we collect to:</Text>
          <Text style={styles.bulletPoint}>
            • Provide, maintain, and improve our services
          </Text>
          <Text style={styles.bulletPoint}>
            • Process transactions and manage your wallet
          </Text>
          <Text style={styles.bulletPoint}>
            • Verify task completions and process rewards
          </Text>
          <Text style={styles.bulletPoint}>
            • Communicate with you about your account and our services
          </Text>
          <Text style={styles.bulletPoint}>
            • Detect, prevent, and address technical issues and fraud
          </Text>
          <Text style={styles.bulletPoint}>
            • Comply with legal obligations and enforce our terms
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Information Sharing and Disclosure</Text>
          <Text style={styles.sectionText}>
            We do not sell your personal information. We may share your information only in the following circumstances:
          </Text>
          <Text style={styles.bulletPoint}>
            • With your consent or at your direction
          </Text>
          <Text style={styles.bulletPoint}>
            • With service providers who assist us in operating our platform
          </Text>
          <Text style={styles.bulletPoint}>
            • To comply with legal obligations or respond to legal requests
          </Text>
          <Text style={styles.bulletPoint}>
            • To protect our rights, privacy, safety, or property
          </Text>
          <Text style={styles.bulletPoint}>
            • In connection with a business transfer or merger
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Data Storage and Security</Text>
          <Text style={styles.sectionText}>
            We implement appropriate technical and organizational measures to protect your personal information:
          </Text>
          <Text style={styles.bulletPoint}>
            • Data encryption in transit and at rest
          </Text>
          <Text style={styles.bulletPoint}>
            • Secure authentication and access controls
          </Text>
          <Text style={styles.bulletPoint}>
            • Regular security assessments and updates
          </Text>
          <Text style={styles.bulletPoint}>
            • Cloud-based storage with industry-standard security
          </Text>
          <Text style={styles.sectionText}>
            However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Your Rights and Choices</Text>
          <Text style={styles.sectionText}>You have the right to:</Text>
          <Text style={styles.bulletPoint}>
            • Access and review your personal information
          </Text>
          <Text style={styles.bulletPoint}>
            • Update or correct your account information
          </Text>
          <Text style={styles.bulletPoint}>
            • Delete your account and associated data
          </Text>
          <Text style={styles.bulletPoint}>
            • Opt-out of certain communications
          </Text>
          <Text style={styles.bulletPoint}>
            • Request a copy of your data
          </Text>
          <Text style={styles.sectionText}>
            You can exercise these rights by contacting us through the app's support channels or by email.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Cookies and Tracking Technologies</Text>
          <Text style={styles.sectionText}>
            We use cookies and similar tracking technologies to track activity on our app and store certain information. You can instruct your device to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Third-Party Services</Text>
          <Text style={styles.sectionText}>
            Our app may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
          <Text style={styles.sectionText}>
            Our service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Data Retention</Text>
          <Text style={styles.sectionText}>
            We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy, unless a longer retention period is required or permitted by law. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. International Data Transfers</Text>
          <Text style={styles.sectionText}>
            Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. By using our service, you consent to the transfer of your information to these facilities.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Changes to This Privacy Policy</Text>
          <Text style={styles.sectionText}>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Us</Text>
          <Text style={styles.sectionText}>
            If you have any questions about this Privacy Policy, please contact us through:
          </Text>
          <Text style={styles.bulletPoint}>
            • In-app support channels (Telegram, WhatsApp)
          </Text>
          <Text style={styles.bulletPoint}>
            • Email: support@earntaskplatform.com
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using Earn Task Platform, you acknowledge that you have read and understood this Privacy Policy and agree to the collection and use of information in accordance with this policy.
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
    marginTop: 20,
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

export default PrivacyPolicyScreen;
