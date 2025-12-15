import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function PrivacyScreen() {
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
        <ThemedText style={styles.headerTitle}>Privacy Policy</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.lastUpdated}>Last Updated: December 2025</ThemedText>

        <ThemedText style={styles.sectionTitle}>1. Information We Collect</ThemedText>
        <ThemedText style={styles.paragraph}>
          We collect information that you provide directly to us, including:
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Account information (email, name, profile picture)
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • OAuth tokens and credentials for third-party integrations
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Usage data and interaction logs
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Messages and conversations with the AI assistant
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>2. How We Use Your Information</ThemedText>
        <ThemedText style={styles.paragraph}>
          We use the information we collect to:
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Provide, maintain, and improve our services
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Process your requests and transactions
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Send you technical notices and support messages
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Respond to your comments and questions
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>3. Data Storage and Security</ThemedText>
        <ThemedText style={styles.paragraph}>
          We implement appropriate technical and organizational measures to protect your personal information. All OAuth tokens and credentials are encrypted before storage. However, no method of transmission over the Internet or electronic storage is 100% secure.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>4. Third-Party Services</ThemedText>
        <ThemedText style={styles.paragraph}>
          The Service integrates with third-party services. When you connect these services, we store encrypted OAuth tokens to facilitate the integration. Your use of third-party services is subject to their respective privacy policies.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>5. Data Sharing</ThemedText>
        <ThemedText style={styles.paragraph}>
          We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • With your explicit consent
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • To comply with legal obligations
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • To protect our rights and safety
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • With service providers who assist in operating our Service
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>6. AI and Data Processing</ThemedText>
        <ThemedText style={styles.paragraph}>
          Your conversations and interactions with the AI assistant may be processed by third-party AI providers (such as OpenAI, Anthropic, or AWS Bedrock) to generate responses. These providers may have their own data processing policies.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>7. Your Rights</ThemedText>
        <ThemedText style={styles.paragraph}>
          You have the right to:
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Access your personal information
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Request correction of inaccurate data
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Request deletion of your account and data
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Disconnect third-party integrations at any time
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>8. Cookies and Tracking</ThemedText>
        <ThemedText style={styles.paragraph}>
          We use cookies and similar tracking technologies to track activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>9. Children's Privacy</ThemedText>
        <ThemedText style={styles.paragraph}>
          Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>10. Changes to This Policy</ThemedText>
        <ThemedText style={styles.paragraph}>
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>11. Contact Us</ThemedText>
        <ThemedText style={styles.paragraph}>
          If you have any questions about this Privacy Policy, please contact us at neviljobanputra34@gmail.com
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

