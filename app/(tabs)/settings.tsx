import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatTokenCount, getUserUsage, getWarningColor, type TokenUsage } from '@/services/usage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const navigation = useNavigation();
  
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [lastLoadTime, setLastLoadTime] = useState(0);
  
  // Load token usage only once on mount and when screen comes into focus
  // Debounce: Only reload if it's been more than 5 seconds since last load
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      // Only reload if it's been more than 5 seconds since last load
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
          <ThemedText style={styles.title}>Settings</ThemedText>
        </View>

        {/* Token Usage Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Token Usage</ThemedText>
            <TouchableOpacity
              onPress={loadUsage}
              disabled={loadingUsage}
              style={styles.refreshButton}>
              <IconSymbol
                name="arrow.clockwise"
                size={20}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.usageBox,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
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
                
                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        width: `${Math.min(parseFloat(usage.usagePercentage), 100)}%`,
                        backgroundColor: getWarningColor(usage.warningLevel)
                      }
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
                
                {/* Plan Management Button */}
                <TouchableOpacity
                  style={[
                    styles.upgradeButton,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                      borderColor: usage.plan === 'free' ? '#4a9eff' : '#4a9eff', // Pro plan color
                      borderWidth: 2,
                    }
                  ]}
                  onPress={() => {
                    // @ts-ignore - navigation exists in tab context
                    navigation?.navigate?.('pricing');
                  }}>
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

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <View
            style={[
              styles.aboutBox,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
            ]}>
            <View style={styles.aboutContent}>
              <ThemedText style={styles.aboutTitle}>
                <ThemedText style={styles.aboutTitleBlue}>Bridge AI</ThemedText>
              </ThemedText>
              <ThemedText style={styles.aboutDescription}>
                Bridge AI is a powerful AI assistant that connects to multiple apps on your phone, making your life simpler and more efficient.
              </ThemedText>
              
              <View style={styles.infoSubsection}>
                <ThemedText style={styles.subsectionTitle}>Privacy & Security</ThemedText>
                <ThemedText style={styles.subsectionText}>
                  All user data is encrypted and stored securely. We maintain strict privacy standards and do not share, sell, or distribute your personal information or data to any third parties.
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
                  Built with cutting-edge AI technology and Model Context Protocol (MCP) to provide intelligent, context-aware assistance across your digital ecosystem.
                </ThemedText>
              </View>
            </View>
            
            <View style={styles.developerSection}>
              <View style={styles.developerDivider} />
              <ThemedText style={styles.developerLabel}>Developed by</ThemedText>
              <View style={styles.developerLinks}>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://www.linkedin.com/in/nevil-jobanputra/')}>
                  <ThemedText style={styles.developerLink}>
                    Nevil Jobanputra
                  </ThemedText>
                </TouchableOpacity>
                <ThemedText style={styles.developerSeparator}>•</ThemedText>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://www.linkedin.com/in/kushal-nandha/')}>
                  <ThemedText style={styles.developerLink}>
                    Kushal Nandha
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
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
  aboutBox: {
    padding: 20,
    borderRadius: 12,
  },
  aboutContent: {
    marginBottom: 20,
  },
  aboutTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    lineHeight: 28,
  },
  aboutTitleBlue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4a9eff',
  },
  aboutDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    opacity: 0.9,
  },
  infoSubsection: {
    marginTop: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.9,
  },
  subsectionText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  developerSection: {
    marginTop: 16,
    paddingTop: 16,
  },
  developerDivider: {
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    marginBottom: 16,
  },
  developerLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  developerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  developerLink: {
    fontSize: 15,
    color: '#4a9eff',
    fontWeight: '600',
  },
  developerSeparator: {
    fontSize: 16,
    opacity: 0.4,
    marginHorizontal: 12,
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

