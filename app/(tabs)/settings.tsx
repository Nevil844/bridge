import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <ThemedText style={styles.title}>Settings</ThemedText>
        </View>

        {/* Settings Options */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.settingButton,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            ]}
            onPress={() => router.push('/usage')}>
            <View style={styles.settingButtonContent}>
              <IconSymbol
                name="chart.bar"
                size={24}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
              <View style={styles.settingButtonText}>
                <ThemedText style={styles.settingButtonTitle}>Usage</ThemedText>
                <ThemedText style={styles.settingButtonSubtitle}>
                  View your token usage and plan details
                </ThemedText>
              </View>
            </View>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={isDark ? '#8E8E93' : '#8E8E93'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.settingButton,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            ]}
            onPress={() => {
              router.push('/preferences');
            }}>
            <View style={styles.settingButtonContent}>
              <IconSymbol
                name="gearshape"
                size={24}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
              <View style={styles.settingButtonText}>
                <ThemedText style={styles.settingButtonTitle}>Preferences</ThemedText>
                <ThemedText style={styles.settingButtonSubtitle}>
                  Theme, tool approval, and other settings
                </ThemedText>
              </View>
            </View>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={isDark ? '#8E8E93' : '#8E8E93'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.settingButton,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            ]}
            onPress={() => router.push('/about')}>
            <View style={styles.settingButtonContent}>
              <IconSymbol
                name="info.circle"
                size={24}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
              <View style={styles.settingButtonText}>
                <ThemedText style={styles.settingButtonTitle}>About</ThemedText>
                <ThemedText style={styles.settingButtonSubtitle}>
                  App information and developer details
                </ThemedText>
              </View>
            </View>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={isDark ? '#8E8E93' : '#8E8E93'}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>Bridge AI 1.0.0</ThemedText>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingButtonText: {
    marginLeft: 12,
    flex: 1,
  },
  settingButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingButtonSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  usageBox: {
    padding: 16,
    borderRadius: 12,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  usagePlan: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  usagePercentage: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  usageStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  usageLabel: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 4,
  },
  usageValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningBanner: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  upgradeButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

