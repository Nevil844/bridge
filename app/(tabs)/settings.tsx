import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_CONFIG } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Settings</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <View
            style={[
              styles.infoBox,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
            ]}>
            <ThemedText style={styles.infoText}>
              This app uses OpenRouter API to provide AI responses.
            </ThemedText>
            <ThemedText style={styles.infoText}>
              Select your preferred AI model from the dropdown in the Chat screen.
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Backend Server</ThemedText>
          <View
            style={[
              styles.infoBox,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
            ]}>
            <ThemedText style={styles.infoLabel}>Server URL:</ThemedText>
            <ThemedText style={styles.infoValue}>
              {API_CONFIG.BASE_URL}
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Resources</ThemedText>
          <TouchableOpacity
            style={[
              styles.linkButton,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
            ]}
            onPress={() => Linking.openURL('https://openrouter.ai')}>
            <ThemedText style={styles.linkText}>OpenRouter Website</ThemedText>
            <ThemedText style={styles.linkArrow}>→</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.linkButton,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
            ]}
            onPress={() => Linking.openURL('https://openrouter.ai/keys')}>
            <ThemedText style={styles.linkText}>Get API Key</ThemedText>
            <ThemedText style={styles.linkArrow}>→</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>AI Chat App v1.0</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500',
  },
  linkArrow: {
    fontSize: 18,
    opacity: 0.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.3,
  },
});

