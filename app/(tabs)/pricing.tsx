import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { formatTokenCount, getUserUsage, getWarningColor, type TokenUsage } from '@/services/usage';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

interface Plan {
  id: string;
  name: string;
  price: string;
  priceMonthly: number;
  tokens: string;
  tokensCount: number;
  features: string[];
  color: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceMonthly: 0,
    tokens: '200K',
    tokensCount: 200000,
    features: [],
    color: '#888',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    priceMonthly: 20,
    tokens: '1.25M',
    tokensCount: 1250000,
    features: [],
    color: '#4a9eff',
    popular: true,
  },
  {
    id: 'power',
    name: 'Power',
    price: '$48',
    priceMonthly: 48,
    tokens: '3M',
    tokensCount: 3000000,
    features: [],
    color: '#ff8800',
  },
];

export default function PricingScreen() {
  const colorScheme = useColorScheme();
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 16, bottom: 24 });
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const router = useRouter();
  
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [feedback, setFeedback] = useState('');

  // Get plan tier for comparison (higher number = higher tier)
  const getPlanTier = (planId: string): number => {
    const tierMap: { [key: string]: number } = {
      'free': 0,
      'pro': 1,
      'power': 2,
    };
    return tierMap[planId] || 0;
  };

  // Get button text based on plan comparison
  const getButtonText = (plan: Plan): string => {
    const currentPlan = user?.plan || 'free';
    if (plan.id === currentPlan) {
      return 'Current Plan';
    }
    
    const currentTier = getPlanTier(currentPlan);
    const planTier = getPlanTier(plan.id);
    
    if (planTier > currentTier) {
      return 'Upgrade Now';
    } else {
      return 'Change Plan';
    }
  };

  const handleUpgrade = async (plan: Plan) => {
    const currentPlan = user?.plan || 'free';
    if (plan.id === currentPlan) {
      if (Platform.OS === 'web') {
        alert(`You are already on the ${plan.name} plan.`);
      } else {
        Alert.alert('Current Plan', `You are already on the ${plan.name} plan.`);
      }
      return;
    }

    const currentTier = getPlanTier(currentPlan);
    const planTier = getPlanTier(plan.id);
    const isUpgrade = planTier > currentTier;

    // Show confirmation - use web-compatible alert
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `${isUpgrade ? 'Upgrade' : 'Change'} to ${plan.name}?\n\n` +
        `You'll ${isUpgrade ? 'be charged' : 'get'} ${plan.price === '$0' ? 'free' : plan.price + '/month'} and get ${plan.tokens} tokens per month.`
      );
      if (confirmed) {
        processUpgrade(plan);
      }
    } else {
      Alert.alert(
        `${isUpgrade ? 'Upgrade' : 'Change'} to ${plan.name}?`,
        `You'll ${isUpgrade ? 'be charged' : 'get'} ${plan.price === '$0' ? 'free' : plan.price + '/month'} and get ${plan.tokens} tokens per month.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: isUpgrade ? 'Upgrade' : 'Change Plan', onPress: () => processUpgrade(plan) },
        ]
      );
    }
  };

  const processUpgrade = async (plan: Plan) => {
    // For free plan, skip the LinkedIn flow
    if (plan.id === 'free') {
      if (Platform.OS === 'web') {
        alert('You are already on or switching to the free plan. No action needed.');
      } else {
        Alert.alert('Free Plan', 'You are already on or switching to the free plan. No action needed.');
      }
      return;
    }

    // For paid plans, show feedback modal
    setSelectedPlan(plan);
    setShowFeedbackModal(true);
  };

  const handleSendLinkedInMessage = async () => {
    if (!selectedPlan || !user) return;

    try {
      setIsUpgrading(true);
      
      // Create the message
      const userName = user.name || user.email || 'User';
      const userEmail = user.email || 'Not provided';
      const currentPlan = user.plan || 'free';
      
      // Determine if it's an upgrade or plan change
      const currentTier = getPlanTier(currentPlan);
      const requestedTier = getPlanTier(selectedPlan.id);
      const isUpgrade = requestedTier > currentTier;
      const action = isUpgrade ? 'upgrade' : 'change';
      
      const message = `Hi Nevil,

I would like to ${action} my Bridge AI plan to ${selectedPlan.name.toUpperCase()}.

User Details:
- Name: ${userName}
- Email: ${userEmail}
- Current Plan: ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
- Requested Plan: ${selectedPlan.name} (${selectedPlan.price}/month - ${selectedPlan.tokens} tokens)

${feedback ? `Feedback/Notes:\n${feedback}\n\n` : ''}Please ${action} my plan when convenient.

Thank you!`;

      // LinkedIn profile URL
      const linkedInUrl = 'https://www.linkedin.com/in/nevil-jobanputra/';
      
      // Copy message to clipboard first
      await Clipboard.setStringAsync(message);

      // Show instructions FIRST, then open LinkedIn
      if (Platform.OS === 'web') {
        const shouldOpen = window.confirm(
          `Message Copied to Clipboard! ✅\n\nYour upgrade request message has been copied.\n\nNext steps:\n1. Click OK to open Nevil's LinkedIn profile\n2. Click "Message" on his profile\n3. Paste the message (Ctrl+V / Cmd+V)\n4. Send it to request your plan upgrade\n\nClick OK to open LinkedIn now.`
        );
        
        if (shouldOpen) {
          // Open LinkedIn after user confirms
          if (typeof window !== 'undefined') {
            window.open(linkedInUrl, '_blank');
          }
          
          // Show message view option
          const viewMessage = window.confirm('Would you like to view the message you copied?');
          if (viewMessage) {
            alert('Your Message:\n\n' + message);
          }
        }
      } else {
        Alert.alert(
          '📱 Message Copied!',
          `Your upgrade request message has been copied to clipboard.\n\nNext steps:\n1. Click "Open LinkedIn" below\n2. Click "Message" on Nevil's profile\n3. Paste the message\n4. Send it to request your plan upgrade`,
          [
            { 
              text: 'View Message', 
              onPress: () => {
                Alert.alert('Your Message', message, [
                  { text: 'OK' }
                ]);
              }
            },
            { 
              text: 'Open LinkedIn', 
              onPress: async () => {
                // Open LinkedIn after user confirms
                const linkedInAppUrl = 'linkedin://in/nevil-jobanputra';
                const canOpenApp = await Linking.canOpenURL(linkedInAppUrl);
                
                if (canOpenApp) {
                  await Linking.openURL(linkedInAppUrl);
                } else {
                  await Linking.openURL(linkedInUrl);
                }
              }
            },
            { text: 'Done', onPress: () => setShowFeedbackModal(false) }
          ]
        );
      }

      setShowFeedbackModal(false);
      setFeedback('');
      
    } catch (error) {
      console.error('Error opening LinkedIn:', error);
      if (Platform.OS === 'web') {
        alert('Could not open LinkedIn. Please manually message Nevil at https://www.linkedin.com/in/nevil-jobanputra/');
      } else {
        Alert.alert('Error', 'Could not open LinkedIn. Please manually message Nevil at https://www.linkedin.com/in/nevil-jobanputra/');
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  // Fetch usage data
  useEffect(() => {
    const fetchUsage = async () => {
      if (!user?.id) {
        setIsLoadingUsage(false);
        return;
      }

      try {
        setIsLoadingUsage(true);
        const usageData = await getUserUsage(user.id, user.plan || 'free');
        setUsage(usageData);
      } catch (error) {
        console.error('Failed to fetch usage:', error);
      } finally {
        setIsLoadingUsage(false);
      }
    };

    fetchUsage();
  }, [user?.id, user?.plan]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        <View style={[styles.header, { paddingTop: topInset + 20 }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.title}>Choose Your Plan</ThemedText>
              <ThemedText style={styles.subtitle}>
                Upgrade for more tokens and advanced features
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => router.replace('/usage')}
              style={styles.closeButton}>
              <IconSymbol
                name="xmark.circle.fill"
                size={28}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Usage Display */}
        {user && (
          <View style={[
            styles.usageCard,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
              borderColor: usage ? getWarningColor(usage.warningLevel) : '#888',
            }
          ]}>
            <View style={styles.usageHeader}>
              <ThemedText style={styles.usageTitle}>Current Usage</ThemedText>
              {usage && (
                <ThemedText style={[styles.usagePlan, { textTransform: 'capitalize' }]}>
                  {usage.plan} Plan
                </ThemedText>
              )}
            </View>
            
            {isLoadingUsage ? (
              <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#000000'} style={styles.usageLoader} />
            ) : usage ? (
              <>
                <View style={styles.usageStats}>
                  <View style={styles.usageStatItem}>
                    <ThemedText style={styles.usageStatValue}>
                      {formatTokenCount(usage.totalTokens)}
                    </ThemedText>
                    <ThemedText style={styles.usageStatLabel}>Used</ThemedText>
                  </View>
                  <View style={styles.usageStatItem}>
                    <ThemedText style={styles.usageStatValue}>
                      {formatTokenCount(usage.limit)}
                    </ThemedText>
                    <ThemedText style={styles.usageStatLabel}>Limit</ThemedText>
                  </View>
                  <View style={styles.usageStatItem}>
                    <ThemedText style={[styles.usageStatValue, { color: getWarningColor(usage.warningLevel) }]}>
                      {formatTokenCount(usage.remainingTokens)}
                    </ThemedText>
                    <ThemedText style={styles.usageStatLabel}>Remaining</ThemedText>
                  </View>
                </View>
                
                <View style={styles.progressBarContainer}>
                  <View style={[
                    styles.progressBar,
                    {
                      width: `${Math.min(parseFloat(usage.usagePercentage), 100)}%`,
                      backgroundColor: getWarningColor(usage.warningLevel),
                    }
                  ]} />
                </View>
                
                <ThemedText style={styles.usagePercentage}>
                  {usage.usagePercentage}% used
                </ThemedText>
              </>
            ) : (
              <ThemedText style={styles.usageError}>Unable to load usage data</ThemedText>
            )}
          </View>
        )}

        {/* Plans Section */}
        <View style={styles.plansSection}>
          <ThemedText style={styles.plansSectionTitle}>Available Plans</ThemedText>
        </View>

        {PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                borderColor: plan.color,
                borderWidth: 2,
                paddingTop: plan.popular ? 48 : 20, // Extra padding only for popular plan
              },
            ]}>
            {plan.popular && (
              <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
                <ThemedText style={styles.popularText}>MOST POPULAR</ThemedText>
              </View>
            )}

            <View style={styles.planHeader}>
              <View style={styles.planNameContainer}>
                <ThemedText style={styles.planName}>{plan.name}</ThemedText>
                <ThemedText style={styles.planTokens}>{plan.tokens} tokens/month</ThemedText>
              </View>
              <View style={styles.priceContainer}>
                <View style={styles.priceWrapper}>
                  <ThemedText 
                    style={[styles.planPrice, { color: plan.color }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {plan.price}
                  </ThemedText>
                  {plan.priceMonthly > 0 && (
                    <ThemedText style={styles.planPricePeriod}>/month</ThemedText>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.upgradeButton,
                { 
                  backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                  borderColor: plan.color,
                  borderWidth: 2,
                }
              ]}
              onPress={() => handleUpgrade(plan)}
              disabled={isUpgrading}>
              {isUpgrading ? (
                <ActivityIndicator color={isDark ? '#FFFFFF' : '#000000'} />
              ) : (
                <ThemedText style={styles.upgradeButtonText}>
                  {getButtonText(plan)}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.infoSection}>
          <ThemedText style={styles.infoTitle}>💡 What are tokens?</ThemedText>
          <ThemedText style={styles.infoText}>
            Tokens are used to measure AI usage. Roughly:
          </ThemedText>
          <ThemedText style={styles.infoText}>• 1 token ≈ 4 characters</ThemedText>
          <ThemedText style={styles.infoText}>• 100 tokens ≈ 75 words</ThemedText>
          <ThemedText style={styles.infoText}>• 1,000 tokens ≈ 750 words</ThemedText>
          <ThemedText style={[styles.infoText, { marginTop: 12 }]}>
            Your usage resets on the 1st of each month.
          </ThemedText>
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            All plans include access to Claude, Gemini, and other AI models
          </ThemedText>
        </View>
      </ScrollView>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowFeedbackModal(false);
          setFeedback('');
        }}>
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }
          ]}>
            <ThemedText style={styles.modalTitle}>
              Request Plan Upgrade
            </ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              We'll open LinkedIn to message Nevil. Add any feedback or notes below (optional):
            </ThemedText>
            
            <TextInput
              style={[
                styles.feedbackInput,
                {
                  backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  color: isDark ? '#FFFFFF' : '#000000',
                }
              ]}
              placeholder="Any feedback, questions, or special requests?"
              placeholderTextColor={isDark ? '#888' : '#999'}
              multiline
              numberOfLines={4}
              value={feedback}
              onChangeText={setFeedback}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedback('');
                }}>
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSend]}
                onPress={handleSendLinkedInMessage}
                disabled={isUpgrading}>
                {isUpgrading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                    Open LinkedIn
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    lineHeight: 22,
  },
  closeButton: {
    padding: 4,
    marginTop: 4,
  },
  planCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  popularText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 4, // Extra space after badge
  },
  planNameContainer: {
    flex: 1,
    marginRight: 12,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 28,
  },
  planTokens: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 18,
  },
  priceContainer: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  priceWrapper: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 36,
    textAlign: 'right',
  },
  planPricePeriod: {
    fontSize: 14,
    opacity: 0.5,
    lineHeight: 18,
    marginTop: 2,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    marginLeft: 12,
    flex: 1,
  },
  upgradeButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    padding: 20,
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'center',
  },
  usageCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  usageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  usagePlan: {
    fontSize: 14,
    opacity: 0.7,
    fontWeight: '600',
  },
  usageLoader: {
    paddingVertical: 20,
  },
  usageStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  usageStatItem: {
    alignItems: 'center',
  },
  usageStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  usageStatLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  usagePercentage: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  usageError: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 20,
  },
  plansSection: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  plansSectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
    lineHeight: 20,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  modalButtonSend: {
    backgroundColor: '#4a9eff',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

