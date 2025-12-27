import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const ADMIN_EMAIL = 'neviljobanputra34@gmail.com';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 16, bottom: 24 });
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
      >
        <View style={[styles.header, { paddingTop: topInset + 20 }]}>
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
            onPress={() => router.push('/profile')}>
            <View style={styles.settingButtonContent}>
              <IconSymbol
                name="person.circle.fill"
                size={24}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
              <View style={styles.settingButtonText}>
                <ThemedText style={styles.settingButtonTitle}>Profile</ThemedText>
                <ThemedText style={styles.settingButtonSubtitle}>
                  View your profile and account settings
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
                  Personalize your experience
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

          {/* Admin Section - Only visible to admin */}
          {isAdmin && (
            <>
              <View style={[styles.sectionDivider, { borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />
              <ThemedText style={[styles.sectionTitle, { marginBottom: 12 }]}>Admin</ThemedText>
              
              <TouchableOpacity
                style={[
                  styles.settingButton,
                  styles.adminButton,
                  { 
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    borderColor: '#FF9500',
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  // @ts-ignore - admin route
                  router.push('/admin');
                }}>
                <View style={styles.settingButtonContent}>
                  <IconSymbol
                    name="shield.fill"
                    size={24}
                    color="#FF9500"
                  />
                  <View style={styles.settingButtonText}>
                    <ThemedText style={[styles.settingButtonTitle, { color: '#FF9500' }]}>Admin Dashboard</ThemedText>
                    <ThemedText style={styles.settingButtonSubtitle}>
                      Manage users, view stats, and approvals
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol
                  name="chevron.right"
                  size={20}
                  color={isDark ? '#8E8E93' : '#8E8E93'}
                />
              </TouchableOpacity>
            </>
          )}
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
  sectionDivider: {
    borderTopWidth: 1,
    marginVertical: 24,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  adminButton: {
    borderColor: '#FF9500',
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

