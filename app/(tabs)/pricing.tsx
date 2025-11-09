import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    features: [
      '200K tokens/month',
      'Basic AI models',
      'GitHub integration',
      'Community support',
    ],
    color: '#888',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    priceMonthly: 20,
    tokens: '1.25M',
    tokensCount: 1250000,
    features: [
      '1.25M tokens/month',
      'All AI models',
      'All integrations',
      'Priority support',
      'Advanced features',
    ],
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
    features: [
      '3M tokens/month',
      'All Pro features',
      'Custom integrations',
      'API access',
      'Team collaboration',
    ],
    color: '#ff8800',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    priceMonthly: 0,
    tokens: '10M+',
    tokensCount: 10000000,
    features: [
      '10M+ tokens/month',
      'Unlimited models',
      'Custom deployment',
      'SLA guarantee',
      'Dedicated support',
    ],
    color: '#9c27b0',
  },
];

export default function PricingScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async (plan: Plan) => {
    if (plan.id === 'enterprise') {
      Alert.alert(
        'Enterprise Plan',
        'Contact our sales team for enterprise pricing and custom solutions.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Contact Sales', onPress: () => {
            // TODO: Open contact form or email
            Alert.alert('Coming Soon', 'Contact form will be available soon.');
          }},
        ]
      );
      return;
    }

    const currentPlan = user?.plan || 'free';
    if (plan.id === currentPlan) {
      Alert.alert('Current Plan', `You are already on the ${plan.name} plan.`);
      return;
    }

    // Show confirmation
    Alert.alert(
      `Upgrade to ${plan.name}?`,
      `You'll be charged ${plan.price}/month and get ${plan.tokens} tokens per month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => processUpgrade(plan) },
      ]
    );
  };

  const processUpgrade = async (plan: Plan) => {
    try {
      setIsUpgrading(true);
      
      // TODO: Integrate with payment processor (Stripe, etc.)
      // For now, just show a placeholder
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      Alert.alert(
        '🎉 Coming Soon!',
        `Payment integration is under development.\n\nYou selected: ${plan.name} plan (${plan.price}/month)\n\nFor now, you can continue using the free plan.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Upgrade error:', error);
      Alert.alert('Error', 'Failed to process upgrade. Please try again.');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <ThemedText style={styles.title}>Choose Your Plan</ThemedText>
          <ThemedText style={styles.subtitle}>
            Upgrade for more tokens and advanced features
          </ThemedText>
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

            <View style={styles.featuresContainer}>
              {plan.features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={20}
                    color={plan.color}
                  />
                  <ThemedText style={styles.featureText}>{feature}</ThemedText>
                </View>
              ))}
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
                  {plan.id === (user?.plan || 'free') ? 'Current Plan' : 
                   plan.id === 'enterprise' ? 'Contact Sales' : 
                   'Upgrade Now'}
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
});

