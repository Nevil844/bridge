import { GlowingOrb } from '@/components/glowing-orb';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_ENDPOINTS } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

export default function LandingScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobile = width < 768;

  // Animations
  const floatAnimation = useSharedValue(0);
  const pulseAnimation = useSharedValue(1);
  const rotateAnimation = useSharedValue(0);

  useEffect(() => {
    floatAnimation.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    pulseAnimation.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    rotateAnimation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnimation.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnimation.value }],
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateAnimation.value}deg` }],
  }));

  const handleJoinWaitlist = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.WAITLIST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          '🎉 Welcome to the Future!',
          'You\'ve been added to the waitlist. Get ready for an AI experience like no other!',
          [{ text: 'Awesome!', onPress: () => setEmail('') }]
        );
      } else {
        if (data.error?.includes('already exists')) {
          Alert.alert(
            '👋 We Remember You!',
            'You\'re already on our exclusive waitlist. We\'ll notify you the moment we launch!'
          );
        } else {
          Alert.alert('Error', data.error || 'Failed to join waitlist. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect. Please check your internet and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const maxWidth = isWeb ? 1200 : width;
  const contentPadding = isMobile ? 20 : isWeb ? 60 : 40;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: contentPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.contentWrapper, { maxWidth, alignSelf: 'center', width: '100%' }]}>
            
            {/* Hero Section */}
            <Animated.View
              entering={FadeInDown.duration(1000).delay(200)}
              style={styles.heroSection}
            >
              <Animated.View style={[styles.orbContainer, floatStyle]}>
                <Animated.View style={rotateStyle}>
                  <GlowingOrb isActive={true} />
                </Animated.View>
              </Animated.View>

              <Animated.View
                entering={FadeInUp.duration(1000).delay(400)}
                style={styles.titleContainer}
              >
                <LinearGradient
                  colors={isDark ? ['#87C7FF', '#4A9EFF', '#87C7FF'] : ['#007AFF', '#0051D5', '#007AFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.titleGradient}
                >
                  <ThemedText type="title" style={styles.heroTitle}>
                    Bridge AI
                  </ThemedText>
                </LinearGradient>
                <ThemedText style={styles.heroSubtitle}>
                  Your AI-Powered Digital Assistant
                </ThemedText>
              </Animated.View>

              <Animated.View
                entering={FadeIn.duration(1000).delay(600)}
                style={styles.taglineContainer}
              >
                <ThemedText style={[styles.tagline, { maxWidth: isMobile ? '100%' : 600 }]}>
                  Connect all your apps, automate your tasks, and unlock the full potential of AI 
                  with seamless integrations, advanced memory, and intelligent automation
                </ThemedText>
              </Animated.View>
            </Animated.View>

            {/* Stats Section */}
            <Animated.View
              entering={FadeInUp.duration(800).delay(800)}
              style={[styles.statsSection, { flexDirection: isMobile ? 'column' : 'row' }]}
            >
              {[
                { icon: 'link', number: '10+', label: 'Integrations', color: '#4ECDC4' },
                { icon: 'bolt.fill', number: '1M+', label: 'AI Calls', color: '#FFD93D' },
                { icon: 'brain', number: '∞', label: 'Possibilities', color: '#FF6B6B' },
              ].map((stat, index) => (
                <Animated.View
                  key={index}
                  entering={FadeIn.duration(600).delay(1000 + index * 100)}
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? '#1C1C1E' : '#F9F9FB',
                      flex: isMobile ? undefined : 1,
                      width: isMobile ? '100%' : undefined,
                      borderColor: stat.color + '30',
                    },
                  ]}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}>
                    <IconSymbol name={stat.icon as any} size={32} color={stat.color} />
                  </View>
                  <ThemedText style={[styles.statNumber, { color: stat.color }]}>{stat.number}</ThemedText>
                  <ThemedText style={styles.statLabel}>{stat.label}</ThemedText>
                </Animated.View>
              ))}
            </Animated.View>

            {/* Features Section */}
            <Animated.View
              entering={FadeInUp.duration(800).delay(1400)}
              style={styles.featuresSection}
            >
              <ThemedText type="title" style={[styles.sectionTitle, { fontSize: isMobile ? 28 : 36 }]}>
                Powerful Features
              </ThemedText>
              <ThemedText style={styles.sectionSubtitle}>
                Everything you need in one intelligent platform
              </ThemedText>

              <View style={[styles.featuresGrid, { flexDirection: isMobile ? 'column' : 'row' }]}>
                {[
                  {
                    icon: 'brain',
                    title: 'Advanced Memory',
                    description: 'Semantic search with pgvector for context-aware conversations',
                    color: '#FF6B6B',
                    gradient: ['#FF6B6B', '#EE5A6F'],
                  },
                  {
                    icon: 'link',
                    title: 'Smart Integrations',
                    description: 'GitHub, Zomato, Spotify, Zerodha - all connected seamlessly',
                    color: '#4ECDC4',
                    gradient: ['#4ECDC4', '#45B7D1'],
                  },
                  {
                    icon: 'gearshape.fill',
                    title: 'Task Automation',
                    description: 'Order food, manage code, trade stocks - all through AI',
                    color: '#FFD93D',
                    gradient: ['#FFD93D', '#FFC107'],
                  },
                  {
                    icon: 'shield.fill',
                    title: 'Privacy First',
                    description: 'End-to-end encryption with OAuth 2.0 security',
                    color: '#95E1D3',
                    gradient: ['#95E1D3', '#6DD5D5'],
                  },
                  {
                    icon: 'bolt.fill',
                    title: 'Lightning Fast',
                    description: 'Claude Sonnet 4 & Gemini 2.5 Flash for instant responses',
                    color: '#A8E6CF',
                    gradient: ['#A8E6CF', '#7ED8B7'],
                  },
                  {
                    icon: 'sparkles',
                    title: 'Chain of Thought',
                    description: 'See the AI think with transparent multi-step reasoning',
                    color: '#FFB6C1',
                    gradient: ['#FFB6C1', '#FF9AA2'],
                  },
                ].map((feature, index) => (
                  <Animated.View
                    key={index}
                    entering={FadeInUp.duration(600).delay(1600 + index * 100)}
                    style={[
                      styles.featureCard,
                      {
                        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                        width: isMobile ? '100%' : '48%',
                        shadowColor: feature.color,
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[feature.gradient[0], feature.gradient[1]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.featureIconContainer}
                    >
                      <IconSymbol name={feature.icon as any} size={28} color="#FFF" />
                    </LinearGradient>
                    <ThemedText type="defaultSemiBold" style={styles.featureTitle}>
                      {feature.title}
                    </ThemedText>
                    <ThemedText style={styles.featureDescription}>
                      {feature.description}
                    </ThemedText>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>

            {/* Integration Logos */}
            <Animated.View
              entering={FadeInUp.duration(800).delay(2200)}
              style={styles.integrationsSection}
            >
              <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { fontSize: isMobile ? 24 : 32 }]}>
                Works With Your Favorite Apps
              </ThemedText>
              
              <View style={[styles.integrationsGrid, { justifyContent: isMobile ? 'space-around' : 'center' }]}>
                {[
                  { name: 'GitHub', icon: 'chevron.left.forwardslash.chevron.right', color: '#6e5494' },
                  { name: 'Zomato', icon: 'cart.fill', color: '#E23744' },
                  { name: 'Spotify', icon: 'music.note', color: '#1DB954' },
                  { name: 'Zerodha', icon: 'chart.line.uptrend.xyaxis', color: '#387ED1' },
                  { name: 'Drive', icon: 'folder.fill', color: '#4285F4' },
                  { name: 'Slack', icon: 'message.fill', color: '#4A154B' },
                ].map((integration, index) => (
                  <Animated.View
                    key={index}
                    entering={FadeIn.duration(600).delay(2400 + index * 80)}
                    style={[
                      styles.integrationCard,
                      {
                        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                        width: isMobile ? (width - contentPadding * 2 - 24) / 3 : 140,
                      },
                    ]}
                  >
                    <View style={[styles.integrationIconBg, { backgroundColor: integration.color + '20' }]}>
                      <IconSymbol name={integration.icon as any} size={isMobile ? 28 : 36} color={integration.color} />
                    </View>
                    <ThemedText style={styles.integrationName}>{integration.name}</ThemedText>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>

            {/* Waitlist CTA */}
            <Animated.View
              entering={FadeInUp.duration(800).delay(2800)}
              style={styles.waitlistSection}
            >
              <Animated.View style={pulseStyle}>
                <LinearGradient
                  colors={isDark 
                    ? ['#1C1C1E', '#2C2C2E', '#1C1C1E'] 
                    : ['#FFFFFF', '#F9F9FB', '#FFFFFF']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.waitlistCard,
                    {
                      borderColor: isDark ? '#87C7FF' : '#007AFF',
                      padding: isMobile ? 24 : isWeb ? 60 : 40,
                    },
                  ]}
                >
                  <View style={styles.ctaBadge}>
                    <IconSymbol name="sparkles" size={16} color={isDark ? '#87C7FF' : '#007AFF'} />
                    <ThemedText style={[styles.ctaBadgeText, { color: isDark ? '#87C7FF' : '#007AFF' }]}>
                      LAUNCHING SOON
                    </ThemedText>
                  </View>

                  <ThemedText type="title" style={[styles.waitlistTitle, { fontSize: isMobile ? 28 : 42 }]}>
                    Join the Revolution
                  </ThemedText>
                  <ThemedText style={[styles.waitlistSubtitle, { fontSize: isMobile ? 16 : 18 }]}>
                    Be among the first to experience AI-powered automation
                  </ThemedText>

                  <View style={[styles.formContainer, { maxWidth: isMobile ? '100%' : 500 }]}>
                    <View style={styles.inputWrapper}>
                      <IconSymbol
                        name="envelope"
                        size={20}
                        color={isDark ? '#8E8E93' : '#8E8E93'}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.emailInput,
                          {
                            backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                            color: isDark ? '#ECEDEE' : '#11181C',
                            borderColor: isDark ? '#3A3A3C' : '#E5E5EA',
                          },
                        ]}
                        placeholder="Enter your email address"
                        placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                      />
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.joinButton,
                        {
                          opacity: isLoading || !email ? 0.6 : 1,
                        },
                      ]}
                      onPress={handleJoinWaitlist}
                      disabled={isLoading || !email}
                    >
                      <LinearGradient
                        colors={isDark ? ['#87C7FF', '#4A9EFF'] : ['#007AFF', '#0051D5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <ThemedText style={styles.joinButtonText}>
                              Join the Waitlist
                            </ThemedText>
                            <IconSymbol name="arrow.right" size={20} color="#fff" />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.privacyBadge}>
                    <IconSymbol name="lock.fill" size={14} color={isDark ? '#87C7FF' : '#007AFF'} />
                    <ThemedText style={styles.privacyText}>
                      No spam, ever. Unsubscribe anytime.
                    </ThemedText>
                  </View>
                </LinearGradient>
              </Animated.View>
            </Animated.View>

            {/* Footer */}
            <Animated.View
              entering={FadeIn.duration(800).delay(3000)}
              style={styles.footerSection}
            >
              <View style={styles.footerDivider} />
              <ThemedText style={styles.footerText}>
                Built with ❤️ using Claude Sonnet 4 & React Native
              </ThemedText>
              <ThemedText style={styles.footerSubtext}>
                © 2025 Bridge AI. All rights reserved.
              </ThemedText>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 60,
  },
  contentWrapper: {
    width: '100%',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 80,
  },
  orbContainer: {
    marginBottom: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  titleGradient: {
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 24,
    fontWeight: '600',
    opacity: 0.9,
    textAlign: 'center',
  },
  taglineContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 18,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 28,
  },
  statsSection: {
    gap: 16,
    marginBottom: 100,
  },
  statCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 16,
    opacity: 0.7,
    fontWeight: '600',
  },
  featuresSection: {
    marginBottom: 100,
  },
  sectionTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 18,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 48,
  },
  featuresGrid: {
    flexWrap: 'wrap',
    gap: 24,
  },
  featureCard: {
    padding: 28,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 15,
    opacity: 0.7,
    lineHeight: 22,
  },
  integrationsSection: {
    marginBottom: 100,
    alignItems: 'center',
  },
  integrationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 32,
  },
  integrationCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  integrationIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  integrationName: {
    fontSize: 14,
    fontWeight: '600',
  },
  waitlistSection: {
    marginBottom: 80,
  },
  waitlistCard: {
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  ctaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(135, 199, 255, 0.15)',
    marginBottom: 20,
  },
  ctaBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  waitlistTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  waitlistSubtitle: {
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 26,
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 20,
    top: 18,
    zIndex: 1,
  },
  emailInput: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    paddingLeft: 52,
    paddingRight: 20,
    fontSize: 16,
    borderWidth: 2,
  },
  joinButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  privacyText: {
    fontSize: 13,
    opacity: 0.6,
  },
  footerSection: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    marginBottom: 32,
  },
  footerText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 8,
  },
  footerSubtext: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'center',
  },
});
