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

const CommunityGuidelinesScreen: React.FC = () => {
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
        <Text style={styles.title}>Community Guidelines</Text>
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
          Welcome to Earn Task Platform! Our community guidelines help ensure a safe, respectful, and positive environment for all users. By using our platform, you agree to follow these guidelines.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Be Respectful</Text>
          <Text style={styles.sectionText}>
            Treat all community members with respect and kindness:
          </Text>
          <Text style={styles.bulletPoint}>• Use respectful language in all interactions</Text>
          <Text style={styles.bulletPoint}>• Avoid harassment, bullying, or hate speech</Text>
          <Text style={styles.bulletPoint}>• Respect different opinions and perspectives</Text>
          <Text style={styles.bulletPoint}>• Report inappropriate behavior to our support team</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Authentic Content</Text>
          <Text style={styles.sectionText}>
            Share only authentic and original content:
          </Text>
          <Text style={styles.bulletPoint}>• Post original content that you have created or have permission to share</Text>
          <Text style={styles.bulletPoint}>• Do not post copyrighted material without authorization</Text>
          <Text style={styles.bulletPoint}>• Avoid posting misleading or false information</Text>
          <Text style={styles.bulletPoint}>• Ensure all task submissions are genuine and accurate</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Task Completion</Text>
          <Text style={styles.sectionText}>
            Complete tasks honestly and according to requirements:
          </Text>
          <Text style={styles.bulletPoint}>• Follow all task instructions carefully</Text>
          <Text style={styles.bulletPoint}>• Do not use automated tools, bots, or scripts</Text>
          <Text style={styles.bulletPoint}>• Submit accurate proof of task completion</Text>
          <Text style={styles.bulletPoint}>• Do not create multiple accounts to exploit tasks</Text>
          <Text style={styles.bulletPoint}>• Report any issues or concerns about tasks</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Prohibited Content</Text>
          <Text style={styles.sectionText}>
            Do not post or share content that:
          </Text>
          <Text style={styles.bulletPoint}>• Is illegal, harmful, or promotes illegal activities</Text>
          <Text style={styles.bulletPoint}>• Contains violence, graphic content, or explicit material</Text>
          <Text style={styles.bulletPoint}>• Discriminates against individuals or groups</Text>
          <Text style={styles.bulletPoint}>• Contains spam, scams, or fraudulent information</Text>
          <Text style={styles.bulletPoint}>• Violates privacy or shares personal information without consent</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Account Security</Text>
          <Text style={styles.sectionText}>
            Protect your account and the community:
          </Text>
          <Text style={styles.bulletPoint}>• Use a strong, unique password</Text>
          <Text style={styles.bulletPoint}>• Do not share your account credentials</Text>
          <Text style={styles.bulletPoint}>• Report suspicious activity immediately</Text>
          <Text style={styles.bulletPoint}>• Do not attempt to hack or compromise other accounts</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Fair Play</Text>
          <Text style={styles.sectionText}>
            Maintain fair play in all activities:
          </Text>
          <Text style={styles.bulletPoint}>• Do not use cheats, exploits, or unfair advantages</Text>
          <Text style={styles.bulletPoint}>• Do not manipulate the reward system</Text>
          <Text style={styles.bulletPoint}>• Compete fairly with other users</Text>
          <Text style={styles.bulletPoint}>• Respect the platform's rules and limitations</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Creator Responsibilities</Text>
          <Text style={styles.sectionText}>
            If you are a creator, you must:
          </Text>
          <Text style={styles.bulletPoint}>• Provide accurate task descriptions and requirements</Text>
          <Text style={styles.bulletPoint}>• Review submissions fairly and promptly</Text>
          <Text style={styles.bulletPoint}>• Communicate clearly with users</Text>
          <Text style={styles.bulletPoint}>• Follow all platform policies and guidelines</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Reporting Violations</Text>
          <Text style={styles.sectionText}>
            Help us maintain a safe community by reporting violations:
          </Text>
          <Text style={styles.bulletPoint}>• Use the in-app reporting feature</Text>
          <Text style={styles.bulletPoint}>• Contact support through official channels</Text>
          <Text style={styles.bulletPoint}>• Provide detailed information about the violation</Text>
          <Text style={styles.bulletPoint}>• Do not engage in vigilante justice or harassment</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Consequences of Violations</Text>
          <Text style={styles.sectionText}>
            Violations of these guidelines may result in:
          </Text>
          <Text style={styles.bulletPoint}>• Warning or temporary suspension</Text>
          <Text style={styles.bulletPoint}>• Permanent account ban</Text>
          <Text style={styles.bulletPoint}>• Loss of coins or rewards</Text>
          <Text style={styles.bulletPoint}>• Legal action in severe cases</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Contact Us</Text>
          <Text style={styles.sectionText}>
            If you have questions about these guidelines or need to report a violation:
          </Text>
          <Text style={styles.bulletPoint}>• In-app support channels (Telegram, WhatsApp)</Text>
          <Text style={styles.bulletPoint}>• Email: support@earntaskplatform.com</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for being part of our community. Together, we can create a positive and rewarding experience for everyone.
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

export default CommunityGuidelinesScreen;
