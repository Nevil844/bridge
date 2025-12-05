import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
            <ThemedText style={styles.title}>About</ThemedText>
            <View style={styles.placeholder} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.aboutBox, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <View style={styles.aboutContent}>
              <ThemedText style={styles.aboutTitle}>
                <ThemedText style={styles.aboutTitleBlue}>Bridge AI</ThemedText>
              </ThemedText>
              <ThemedText style={styles.aboutDescription}>
                Bridge AI is a powerful AI assistant that connects to multiple apps on your phone, making your life
                simpler and more efficient.
              </ThemedText>

              <View style={styles.infoSubsection}>
                <ThemedText style={styles.subsectionTitle}>Privacy & Security</ThemedText>
                <ThemedText style={styles.subsectionText}>
                  All user data is encrypted and stored securely. We maintain strict privacy standards and do not share,
                  sell, or distribute your personal information or data to any third parties.
                </ThemedText>
              </View>

              <View style={styles.infoSubsection}>
                <ThemedText style={styles.subsectionTitle}>Features</ThemedText>
                <ThemedText style={styles.subsectionText}>
                  • Connect with multiple apps and services{'\n'}
                  • Advanced AI-powered assistance{'\n'}
                  • Secure data management{'\n'}
                  • Seamless integration experience
                </ThemedText>
              </View>

              <View style={styles.infoSubsection}>
                <ThemedText style={styles.subsectionTitle}>Technology</ThemedText>
                <ThemedText style={styles.subsectionText}>
                  Built with cutting-edge AI technology and Model Context Protocol (MCP) to provide intelligent,
                  context-aware assistance across your digital ecosystem.
                </ThemedText>
              </View>
            </View>

            <View style={styles.developerSection}>
              <View style={styles.developerDivider} />
              <ThemedText style={styles.developerLabel}>Developed by</ThemedText>
              <View style={styles.developerLinks}>
                <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/nevil-jobanputra/')}>
                  <ThemedText style={styles.developerLink}>Nevil Jobanputra</ThemedText>
                </TouchableOpacity>
                <ThemedText style={styles.developerSeparator}>•</ThemedText>
                <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/kushal-nandha/')}>
                  <ThemedText style={styles.developerLink}>Kushal Nandha</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { padding: 4 },
  title: { fontSize: 32, fontWeight: 'bold', lineHeight: 40 },
  placeholder: { width: 32 },
  section: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  aboutBox: { padding: 20, borderRadius: 12 },
  aboutContent: { marginBottom: 20 },
  aboutTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, lineHeight: 28 },
  aboutTitleBlue: { fontSize: 22, fontWeight: 'bold', color: '#4a9eff' },
  aboutDescription: { fontSize: 15, lineHeight: 22, marginBottom: 20, opacity: 0.9 },
  infoSubsection: { marginTop: 20 },
  subsectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, opacity: 0.9 },
  subsectionText: { fontSize: 14, lineHeight: 20, opacity: 0.8 },
  developerSection: { marginTop: 16, paddingTop: 16 },
  developerDivider: { height: 1, backgroundColor: 'rgba(128, 128, 128, 0.2)', marginBottom: 16 },
  developerLabel: { fontSize: 12, opacity: 0.6, marginBottom: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  developerLinks: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  developerLink: { fontSize: 15, color: '#4a9eff', fontWeight: '600' },
  developerSeparator: { fontSize: 16, opacity: 0.4, marginHorizontal: 12 },
});

