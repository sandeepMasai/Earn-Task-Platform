import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  title: string;
  subtitle: string;
  signup?: boolean;
  recovery?: boolean;
  children: React.ReactNode;
  onSwitch: () => void;
  loading?: boolean;
}
export default function AuthLayout({ title, subtitle, signup, recovery, children, onSwitch, loading }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 900 && fontScale < 1.5;
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.scroll, { paddingHorizontal: width < 360 ? 16 : 24 }]}>
          <View style={[styles.content, wide && styles.wide]}>
            <View style={[styles.intro, wide && styles.wideIntro]}>
              <View style={styles.brand}>
                <View style={styles.mark}><Ionicons name="flash" size={23} color="#FFFFFF" /></View>
                <Text style={styles.brandText}>EARN TASK<Text style={styles.brandDot}>.</Text></Text>
              </View>
              <View style={styles.tag}><View style={styles.dot} /><Text style={styles.tagText}>YOUR NEXT STEP STARTS HERE</Text></View>
              <Text style={[styles.headline, wide && styles.wideHeadline]}>{recovery ? 'A fresh start.\nSame account.' : signup ? 'Small tasks.\nNew possibilities.' : 'Make today\ncount.'}</Text>
              <Text style={styles.description}>Discover tasks, track your progress, and keep your rewards in one place.</Text>
              {wide && <View style={styles.feature}><Ionicons name="checkmark-circle-outline" size={24} color="#147D64" /><Text style={styles.featureText}>Your progress, at your pace.</Text></View>}
            </View>
            <View style={[styles.card, wide && styles.wideCard]}>
              <View style={styles.cardHeader}>
                <Text accessibilityRole="header" style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
              {children}
              <View style={styles.footer}>
                <Text style={styles.footerText}>{recovery ? 'Remember your password?' : signup ? 'Already have an account?' : "Don’t have an account?"}</Text>
                <Pressable onPress={onSwitch} disabled={loading} accessibilityRole="button" accessibilityLabel={(signup || recovery) ? 'Log in to your account' : 'Create an account'} accessibilityState={{ disabled: !!loading }} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed, loading && styles.pressed]}>
                  <Text style={styles.link}>{(signup || recovery) ? 'Log in' : 'Create an account'}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#176B54" />
                </Pressable>
              </View>
            </View>
          </View>
          <Text style={styles.bottom}>A little progress, every day.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const authStyles = StyleSheet.create({
  submit: { backgroundColor: '#176B54', borderRadius: 16, minHeight: 56, marginTop: 8 },
  hint: { color: '#53645E', fontSize: 13, lineHeight: 20, marginBottom: 18 },
});
const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#F3F6F0' },
  scroll: { flexGrow: 1, paddingVertical: 28, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 540, alignSelf: 'center' },
  wide: { maxWidth: 1100, flexDirection: 'row', alignItems: 'center', gap: 56 },
  intro: { marginBottom: 28 }, wideIntro: { flex: 1, marginBottom: 0 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 26 },
  mark: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#176B54', alignItems: 'center', justifyContent: 'center' },
  brandText: { flexShrink: 1, fontSize: 18, letterSpacing: 1.5, fontWeight: '800', color: '#162D25' }, brandDot: { color: '#147D64' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#147D64' },
  tagText: { flexShrink: 1, color: '#53645E', fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  headline: { fontSize: 36, fontWeight: '800', letterSpacing: -1.3, color: '#162D25', marginBottom: 12 },
  wideHeadline: { fontSize: 52 }, description: { fontSize: 15, lineHeight: 24, color: '#53645E', maxWidth: 360 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 32 }, featureText: { flexShrink: 1, fontSize: 14, color: '#53645E' },
  card: { padding: 22, borderRadius: 26, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DEE7DF' },
  wideCard: { flex: 1, maxWidth: 500, padding: 32 }, cardHeader: { marginBottom: 26 },
  title: { color: '#162D25', fontSize: 26, fontWeight: '700', letterSpacing: -0.6, marginBottom: 8 },
  subtitle: { color: '#53645E', fontSize: 14, lineHeight: 22 },
  footer: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#EEF1EB', alignItems: 'center', gap: 10 },
  footerText: { fontSize: 14, lineHeight: 22, color: '#53645E', textAlign: 'center' },
  linkButton: { width: '100%', minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#D6E5DA', backgroundColor: '#F3F8F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { fontSize: 14, color: '#176B54', fontWeight: '700', flexShrink: 1, textAlign: 'center' }, pressed: { opacity: 0.65 },
  bottom: { color: '#53645E', fontSize: 12, textAlign: 'center', marginTop: 24 },
});
