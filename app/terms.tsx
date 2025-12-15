import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function TermsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 16, bottom: 24 });
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <IconSymbol name="chevron.left" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Terms of Service</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.lastUpdated}>Last Updated: December 2025</ThemedText>

        <ThemedText style={styles.sectionTitle}>1. Acceptance of Terms</ThemedText>
        <ThemedText style={styles.paragraph}>
          By accessing and using Bridge AI ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>2. Description of Service</ThemedText>
        <ThemedText style={styles.paragraph}>
          Bridge AI is an AI-powered assistant that integrates with various third-party services to help you manage your digital life. The Service provides access to tools and integrations that allow you to interact with connected services through natural language.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>3. User Accounts</ThemedText>
        <ThemedText style={styles.paragraph}>
          You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate your account if we suspect any violation of these Terms.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>4. Acceptable Use</ThemedText>
        <ThemedText style={styles.paragraph}>
          You agree not to use the Service:
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • For any illegal purpose or in violation of any laws
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • To transmit any malicious code, viruses, or harmful data
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • To interfere with or disrupt the Service or servers
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • To attempt to gain unauthorized access to any part of the Service
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • To use automated systems to access the Service without permission
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>5. Third-Party Integrations</ThemedText>
        <ThemedText style={styles.paragraph}>
          The Service integrates with third-party services. Your use of these integrations is subject to the terms and conditions of those third-party services. We are not responsible for the availability, accuracy, or content of third-party services.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>6. Intellectual Property</ThemedText>
        <ThemedText style={styles.paragraph}>
          The Service and its original content, features, and functionality are owned by Bridge AI and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>7. Limitation of Liability</ThemedText>
        <ThemedText style={styles.paragraph}>
          In no event shall Bridge AI, its directors, employees, or agents be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the Service.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>8. Termination</ThemedText>
        <ThemedText style={styles.paragraph}>
          We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>9. Changes to Terms</ThemedText>
        <ThemedText style={styles.paragraph}>
          We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>10. Contact Information</ThemedText>
        <ThemedText style={styles.paragraph}>
          If you have any questions about these Terms, please contact us at neviljobanputra34@gmail.com
        </ThemedText>

        <View style={styles.spacer} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  lastUpdated: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 32,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    opacity: 0.9,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
    marginLeft: 16,
    opacity: 0.9,
  },
  spacer: {
    height: 40,
  },
});

