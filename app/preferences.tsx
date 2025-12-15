import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { usePreferences } from '@/hooks/use-preferences';
import { useRouter } from 'expo-router';
import React from 'react';
import { Appearance, Platform, ScrollView, StyleSheet, TouchableOpacity, View, useColorScheme as useRNColorScheme } from 'react-native';

export default function PreferencesScreen() {
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 16, bottom: 24 });
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { toolApprovalEnabled, setToolApprovalEnabled, themePreference, setThemePreference } = usePreferences();
  const systemColorScheme = useRNColorScheme();

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    // Save preference
    await setThemePreference(theme);
    
    // Apply theme change
    if (Platform.OS === 'web') {
      // On web, trigger a storage event to notify other components
      // This will cause useColorScheme hooks to re-check the storage
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'preference_theme',
          newValue: theme,
        }));
        // Also trigger a custom event for immediate updates
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
      }
    } else {
      // On native platforms, use Appearance API if available
      try {
        if (Appearance && typeof Appearance.setColorScheme === 'function') {
          if (theme === 'system') {
            Appearance.setColorScheme(null);
          } else {
            Appearance.setColorScheme(theme);
          }
        }
      } catch (error) {
        console.warn('Could not set color scheme:', error);
        // Preference is still saved, will be used on next load
      }
    }
  };

  // Determine current theme based on preference or system
  const getCurrentTheme = (): 'light' | 'dark' => {
    if (themePreference === 'light') return 'light';
    if (themePreference === 'dark') return 'dark';
    // System or no preference - use system color scheme
    return systemColorScheme || 'light';
  };

  const currentTheme = getCurrentTheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        <View style={[styles.header, { paddingTop: topInset + 20 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}>
              <IconSymbol
                name="chevron.left"
                size={24}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
            <ThemedText style={styles.title}>Preferences</ThemedText>
            <View style={styles.placeholder} />
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Appearance</ThemedText>
          <View
            style={[
              styles.preferenceCard,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            ]}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <ThemedText style={styles.preferenceLabel}>Theme</ThemedText>
                <ThemedText style={styles.preferenceDescription}>
                  Choose light or dark mode
                </ThemedText>
              </View>
              <View style={styles.themeOptions}>
                <TouchableOpacity
                  style={[
                    styles.themeOption,
                    currentTheme === 'light' && styles.themeOptionActive,
                    { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                    currentTheme === 'light' && {
                      backgroundColor: isDark ? '#0A84FF' : '#007AFF',
                    },
                  ]}
                  onPress={() => handleThemeChange('light')}>
                  <ThemedText
                    style={[
                      styles.themeOptionText,
                      currentTheme === 'light' && styles.themeOptionTextActive,
                    ]}>
                    Light
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.themeOption,
                    currentTheme === 'dark' && styles.themeOptionActive,
                    { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                    currentTheme === 'dark' && {
                      backgroundColor: isDark ? '#0A84FF' : '#007AFF',
                    },
                  ]}
                  onPress={() => handleThemeChange('dark')}>
                  <ThemedText
                    style={[
                      styles.themeOptionText,
                      currentTheme === 'dark' && styles.themeOptionTextActive,
                    ]}>
                    Dark
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Tool Settings Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Tool Settings</ThemedText>
          <View
            style={[
              styles.preferenceCard,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            ]}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <ThemedText style={styles.preferenceLabel}>
                  Ask for approval before tool call
                </ThemedText>
                <ThemedText style={styles.preferenceDescription}>
                  When enabled, you'll be asked to approve each tool execution before it runs
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  {
                    backgroundColor: toolApprovalEnabled
                      ? '#34C759'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
                onPress={() => setToolApprovalEnabled(!toolApprovalEnabled)}>
                <View
                  style={[
                    styles.toggleKnob,
                    toolApprovalEnabled && styles.toggleKnobOn,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  placeholder: {
    width: 32,
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
  preferenceCard: {
    borderRadius: 12,
    padding: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    transform: [{ translateX: 0 }],
  },
  toggleKnobOn: {
    transform: [{ translateX: 20 }],
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  themeOptionActive: {
    opacity: 1,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  themeOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 1,
  },
});

