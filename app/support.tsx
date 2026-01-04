import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function SupportScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 16, bottom: 24 });
  const router = useRouter();

  const handleEmailPress = () => {
    Linking.openURL('mailto:neviljobanputra34@gmail.com?subject=Bridge AI Support');
  };

  const handleLinkedInPress = () => {
    const linkedInUrl = 'https://www.linkedin.com/in/nevil-jobanputra/';
    Linking.openURL(linkedInUrl);
  };

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
        <ThemedText style={styles.headerTitle}>Support</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.introText}>
          We're here to help! If you have any questions, issues, or feedback about Bridge AI, please don't hesitate to reach out.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>Frequently Asked Questions</ThemedText>

        <ThemedText style={styles.faqQuestion}>How do I connect my apps?</ThemedText>
        <ThemedText style={styles.faqAnswer}>
          Go to the Integrations tab, tap on any service you want to connect, and follow the OAuth authentication flow. Your credentials are securely stored and encrypted.
        </ThemedText>

        <ThemedText style={styles.faqQuestion}>What are credits?</ThemedText>
        <ThemedText style={styles.faqAnswer}>
          Credits are units that measure your AI usage. They provide a simple way to track how much you've used. Credits reset on the 1st of each month.
        </ThemedText>

        <ThemedText style={styles.faqQuestion}>How do I upgrade my plan?</ThemedText>
        <ThemedText style={styles.faqAnswer}>
          Go to the Pricing tab and select the plan you want. You'll be guided through the upgrade process. For paid plans, you can contact us directly via email or LinkedIn.
        </ThemedText>

        <ThemedText style={styles.faqQuestion}>Is my data secure?</ThemedText>
        <ThemedText style={styles.faqAnswer}>
          Yes! All OAuth tokens and credentials are encrypted before storage. We use industry-standard security practices and never share your data with third parties. See our Privacy Policy for more details.
        </ThemedText>

        <ThemedText style={styles.faqQuestion}>Can I use Bridge AI offline?</ThemedText>
        <ThemedText style={styles.faqAnswer}>
          Bridge AI requires an internet connection to communicate with AI models and third-party services. However, you can view your conversation history offline.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>Report an Issue</ThemedText>
        <ThemedText style={styles.paragraph}>
          If you encounter a bug or technical issue, please email us with:
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • A description of the issue
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Steps to reproduce the problem
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Your device and OS version
        </ThemedText>
        <ThemedText style={styles.bulletPoint}>
          • Screenshots if applicable
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>Feature Requests</ThemedText>
        <ThemedText style={styles.paragraph}>
          We love hearing your ideas! If you have a feature request or suggestion, please reach out via email or connect with us on LinkedIn.
        </ThemedText>

        <TouchableOpacity
          style={[styles.contactButton, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}
          onPress={handleLinkedInPress}
        >
          <View style={{ marginRight: 12 }}>
            <IconSymbol name="link" size={20} color={isDark ? '#4A9EFF' : '#007AFF'} />
          </View>
          <ThemedText style={[styles.contactButtonText, { color: isDark ? '#4A9EFF' : '#007AFF' }]}>
            Connect on LinkedIn
          </ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.sectionTitle}>Contact Us</ThemedText>
        <ThemedText style={styles.paragraph}>
          The best way to reach us is through email. We typically respond within 24-48 hours.
        </ThemedText>

        <TouchableOpacity
          style={[styles.contactButton, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}
          onPress={handleEmailPress}
        >
          <View style={{ marginRight: 12 }}>
            <IconSymbol name="envelope.fill" size={20} color={isDark ? '#4A9EFF' : '#007AFF'} />
          </View>
          <ThemedText style={[styles.contactButtonText, { color: isDark ? '#4A9EFF' : '#007AFF' }]}>
            neviljobanputra34@gmail.com
          </ThemedText>
        </TouchableOpacity>

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
  introText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.9,
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
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  faqQuestion: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    opacity: 0.95,
  },
  faqAnswer: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    opacity: 0.8,
    marginLeft: 4,
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

