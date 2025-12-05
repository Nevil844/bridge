import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatTokenCount, getUserUsage, getWarningColor, type TokenUsage } from '@/services/usage';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

export default function UsageScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const router = useRouter();

  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [lastLoadTime, setLastLoadTime] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (user?.id && (now - lastLoadTime > 5000 || lastLoadTime === 0)) {
        loadUsage();
        setLastLoadTime(now);
      }
    }, [user?.id, lastLoadTime])
  );

  async function loadUsage() {
    if (!user?.id) return;
    try {
      setLoadingUsage(true);
      const plan = user.plan || 'free';
      const data = await getUserUsage(user.id, plan);
      setUsage(data);
    } catch (error) {
      console.error('Error loading usage:', error);
    } finally {
      setLoadingUsage(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
            <ThemedText style={styles.title}>Usage</ThemedText>
            <View style={styles.placeholder} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Token Usage</ThemedText>
            <TouchableOpacity onPress={loadUsage} disabled={loadingUsage} style={styles.refreshButton}>
              <IconSymbol name="arrow.clockwise" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>
          <View style={[
            styles.usageBox, 
            { 
              backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              borderWidth: 1,
            }
          ]}>
            {loadingUsage ? (
              <ActivityIndicator size="small" />
            ) : usage ? (
              <>
                <View style={styles.usageHeader}>
                  <ThemedText style={styles.usagePlan}>{usage.plan.toUpperCase()} Plan</ThemedText>
                  <ThemedText style={[styles.usagePercentage, { color: getWarningColor(usage.warningLevel) }]}>
                    {parseFloat(usage.usagePercentage).toFixed(1)}%
                  </ThemedText>
                </View>

                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(parseFloat(usage.usagePercentage), 100)}%`,
                        backgroundColor: getWarningColor(usage.warningLevel),
                      },
                    ]}
                  />
                </View>

                <View style={styles.usageStats}>
                  <View>
                    <ThemedText style={styles.usageLabel}>Used</ThemedText>
                    <ThemedText style={styles.usageValue}>{formatTokenCount(usage.totalTokens)}</ThemedText>
                  </View>
                  <View>
                    <ThemedText style={styles.usageLabel}>Remaining</ThemedText>
                    <ThemedText style={styles.usageValue}>{formatTokenCount(usage.remainingTokens)}</ThemedText>
                  </View>
                  <View>
                    <ThemedText style={styles.usageLabel}>Limit</ThemedText>
                    <ThemedText style={styles.usageValue}>{formatTokenCount(usage.limit)}</ThemedText>
                  </View>
                </View>

                {usage.warningLevel !== 'none' && (
                  <View style={[styles.warningBanner, { backgroundColor: getWarningColor(usage.warningLevel) + '20' }]}>
                    <ThemedText style={[styles.warningText, { color: getWarningColor(usage.warningLevel) }]}>
                      {usage.warningLevel === 'critical' && '⚠️ You\'re approaching your monthly limit!'}
                      {usage.warningLevel === 'high' && 'High usage detected this month'}
                      {usage.warningLevel === 'medium' && 'You\'ve used 75% of your quota'}
                      {usage.warningLevel === 'low' && '50% of monthly quota used'}
                    </ThemedText>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.upgradeButton,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                      borderColor: '#4a9eff',
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => router.push('/pricing')}>
                  <ThemedText style={styles.upgradeButtonText}>
                    {usage.plan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <ThemedText style={styles.infoText}>Unable to load usage data</ThemedText>
            )}
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  refreshButton: { padding: 8, borderRadius: 8 },
  usageBox: { padding: 16, borderRadius: 12 },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  usagePlan: { fontSize: 14, fontWeight: '600', opacity: 0.7 },
  usagePercentage: { fontSize: 18, fontWeight: 'bold' },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  usageStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  usageLabel: { fontSize: 12, opacity: 0.5, marginBottom: 4 },
  usageValue: { fontSize: 16, fontWeight: '600' },
  warningBanner: { padding: 12, borderRadius: 8, marginTop: 8 },
  warningText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  upgradeButton: { marginTop: 12, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  upgradeButtonText: { fontSize: 15, fontWeight: '600' },
  infoText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
});

