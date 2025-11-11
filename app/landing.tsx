import { GlowingOrb } from '@/components/glowing-orb';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_ENDPOINTS } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import Animated, {
    Easing,
    Extrapolation,
    FadeIn,
    FadeInDown,
    FadeInUp,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

/**
 * Bridge AI — LandingScreen (Premium UI)
 * ------------------------------------------------------------
 * Highlights
 * - Ambient animated gradient background + floating blobs
 * - Glassy cards with soft shadows and subtle press/hover motion
 * - Parallax hero + micro-interactions
 * - Accessible, responsive for mobile/web/tablet
 */

export default function LandingScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobile = width < 768;

  // Layout memo
  const maxWidth = isWeb ? 1200 : width;
  const contentPadding = isMobile ? 20 : isWeb ? 60 : 40;

  // Animations — ambient motion
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-18, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    rotate.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const heroParallax = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 300], [0, -60], Extrapolation.CLAMP);
    const opacity = interpolate(scrollY.value, [0, 300], [1, 0.85], Extrapolation.CLAMP);
    return { transform: [{ translateY }], opacity };
  });

  const bgOverlayOpacity = useMemo(() => (isDark ? 0.75 : 0.5), [isDark]);

  // CTA logic
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          '🎉 Welcome to the Future!',
          "You've been added to the waitlist. Get ready for an AI experience like no other!",
          [{ text: 'Awesome!', onPress: () => setEmail('') }]
        );
      } else {
        if (data?.error?.includes('already exists')) {
          Alert.alert(
            '👋 We Remember You!',
            "You're already on our exclusive waitlist. We'll notify you the moment we launch!"
          );
        } else {
          Alert.alert('Error', data?.error || 'Failed to join waitlist. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      Alert.alert('Connection Error', 'Unable to connect. Please check your internet and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Ambient animated gradient background */}
      <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={isDark ? ['#06080F', '#0E1633', '#0B1024'] : ['#EEF6FF', '#F4F7FF', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Soft noise overlay (simulated with semi-transparent layer) */}
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: isDark ? `rgba(8,12,24,${bgOverlayOpacity})` : `rgba(255,255,255,${bgOverlayOpacity})`,
          }}
        />
        {/* Floating blobs */}
        <Animated.View style={[styles.blob, { top: -80, left: -60 }, floatStyle]} />
        <Animated.View style={[styles.blobAlt, { bottom: -60, right: -40 }, pulseStyle]} />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <Animated.ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: contentPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={[styles.contentWrapper, { maxWidth, alignSelf: 'center', width: '100%' }]}>
            {/* Hero */}
            <Animated.View entering={FadeInDown.duration(900).delay(200)} style={[styles.heroSection, heroParallax]}>
              <Animated.View style={[styles.orbContainer, floatStyle]}>
                <Animated.View style={rotateStyle}>
                  <GlowingOrb isActive />
                </Animated.View>
              </Animated.View>

              <Animated.View entering={FadeInUp.duration(900).delay(350)} style={styles.titleContainer}>
                <LinearGradient
                  colors={isDark ? ['#87C7FF', '#4A9EFF', '#87C7FF'] : ['#007AFF', '#5B8CFF', '#007AFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.titleGradient}
                >
                  <ThemedText type="title" style={[styles.heroTitle, { color: isDark ? '#EAF2FF' : '#FFFFFF' }]}>
                    Bridge AI
                  </ThemedText>
                </LinearGradient>
                <ThemedText style={[styles.heroSubtitle, { color: isDark ? '#E6EEFF' : '#0F172A' }]}>Your AI‑Powered Digital Assistant</ThemedText>
              </Animated.View>

              <Animated.View entering={FadeIn.duration(900).delay(500)} style={styles.taglineContainer}>
                <ThemedText style={[styles.tagline, { maxWidth: isMobile ? '100%' : 720, color: isDark ? '#C7D4F8' : '#334155' }]}>
                  Connect all your apps, automate your tasks, and unlock the full potential of AI with seamless integrations, advanced memory, and intelligent automation.
                </ThemedText>
              </Animated.View>
            </Animated.View>

            {/* Stats */}
            <Animated.View entering={FadeInUp.duration(700).delay(750)} style={[styles.statsSection, { flexDirection: isMobile ? 'column' : 'row' }]}>
              {[
                { icon: 'link', number: '10+', label: 'Integrations', color: '#4ECDC4' },
                { icon: 'bolt.fill', number: '1M+', label: 'AI Calls', color: '#FFD93D' },
                { icon: 'brain', number: '∞', label: 'Possibilities', color: '#8B5CF6' },
              ].map((stat, index) => (
                <Animated.View
                  key={index}
                  entering={FadeIn.duration(550).delay(900 + index * 120)}
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(28,28,30,0.6)' : 'rgba(255,255,255,0.65)',
                      borderColor: stat.color + '40',
                      flex: isMobile ? undefined : 1,
                      width: isMobile ? '100%' : undefined,
                    },
                  ]}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}> 
                    <IconSymbol name={stat.icon as any} size={32} color={stat.color} />
                  </View>
                  <ThemedText style={[styles.statNumber, { color: isDark ? '#EAF2FF' : '#0F172A' }]}>{stat.number}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: isDark ? '#A9B7D9' : '#475569' }]}>{stat.label}</ThemedText>
                </Animated.View>
              ))}
            </Animated.View>

            {/* Features */}
            <Animated.View entering={FadeInUp.duration(700).delay(1100)} style={styles.featuresSection}>
              <ThemedText type="title" style={[styles.sectionTitle, { fontSize: isMobile ? 28 : 36, color: isDark ? '#EAF2FF' : '#0F172A' }]}>Powerful Features</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: isDark ? '#A9B7D9' : '#64748B' }]}>Everything you need in one intelligent platform</ThemedText>

              <View style={[styles.featuresGrid, { flexDirection: isMobile ? 'column' : 'row' }]}> 
                {[
                  { icon: 'brain', title: 'Advanced Memory', description: 'Semantic search with pgvector for context‑aware conversations', color: '#FF6B6B', gradient: ['#FF6B6B', '#EE5A6F'] },
                  { icon: 'link', title: 'Smart Integrations', description: 'GitHub, Zomato, Spotify, Zerodha — all connected seamlessly', color: '#4ECDC4', gradient: ['#4ECDC4', '#45B7D1'] },
                  { icon: 'gearshape.fill', title: 'Task Automation', description: 'Order food, manage code, trade stocks — all through AI', color: '#FFD93D', gradient: ['#FFD93D', '#FFC107'] },
                  { icon: 'shield.fill', title: 'Privacy First', description: 'End‑to‑end encryption with OAuth 2.0 security', color: '#95E1D3', gradient: ['#95E1D3', '#6DD5D5'] },
                  { icon: 'bolt.fill', title: 'Lightning Fast', description: 'Claude Sonnet 4 & Gemini 2.5 Flash for instant responses', color: '#A8E6CF', gradient: ['#A8E6CF', '#7ED8B7'] },
                  { icon: 'sparkles', title: 'Transparent Reasoning', description: 'Explainable, multi‑step task plans (no sensitive data exposed)', color: '#FF9AA2', gradient: ['#FFB6C1', '#FF9AA2'] },
                ].map((feature, index) => (
                  <Animated.View
                    key={index}
                    entering={FadeInUp.duration(550).delay(1300 + index * 90)}
                    style={[
                      styles.featureCard,
                      {
                        backgroundColor: isDark ? 'rgba(28,28,30,0.55)' : 'rgba(255,255,255,0.8)',
                        borderColor: isDark ? '#2E3A55' : '#E5EAF6',
                        width: isMobile ? '100%' : '48%',
                        shadowColor: feature.color,
                      },
                    ]}
                  >
                    <LinearGradient colors={[feature.gradient[0], feature.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureIconContainer}>
                      <IconSymbol name={feature.icon as any} size={28} color="#FFF" />
                    </LinearGradient>
                    <ThemedText type="defaultSemiBold" style={[styles.featureTitle, { color: isDark ? '#EAF2FF' : '#0F172A' }]}>{feature.title}</ThemedText>
                    <ThemedText style={[styles.featureDescription, { color: isDark ? '#B6C4E6' : '#475569' }]}>{feature.description}</ThemedText>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>

            {/* Integrations */}
            <Animated.View entering={FadeInUp.duration(700).delay(1700)} style={styles.integrationsSection}>
              <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { fontSize: isMobile ? 24 : 32, color: isDark ? '#EAF2FF' : '#0F172A' }]}>Works With Your Favorite Apps</ThemedText>
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
                    entering={FadeIn.duration(500).delay(1850 + index * 80)}
                    style={[
                      styles.integrationCard,
                      {
                        backgroundColor: isDark ? 'rgba(28,28,30,0.55)' : 'rgba(255,255,255,0.8)',
                        width: isMobile ? (width - contentPadding * 2 - 24) / 3 : 148,
                        borderColor: 'rgba(148,163,184,0.25)'
                      },
                    ]}
                  >
                    <View style={[styles.integrationIconBg, { backgroundColor: integration.color + '20' }]}>
                      <IconSymbol name={integration.icon as any} size={isMobile ? 28 : 36} color={integration.color} />
                    </View>
                    <ThemedText style={[styles.integrationName, { color: isDark ? '#D9E6FF' : '#334155' }]}>{integration.name}</ThemedText>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>

            {/* Waitlist CTA */}
            <Animated.View entering={FadeInUp.duration(700).delay(2050)} style={styles.waitlistSection}>
              <Animated.View style={pulseStyle}>
                <LinearGradient
                  colors={isDark ? ['#0B1226', '#111A33', '#0B1226'] : ['#FFFFFF', '#F8FAFF', '#FFFFFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.waitlistCard, { padding: isMobile ? 24 : isWeb ? 60 : 40 }]}
                >
                  <View style={[styles.ctaBadge, { backgroundColor: (isDark ? '#87C7FF' : '#007AFF') + '22' }]}> 
                    <IconSymbol name="sparkles" size={16} color={isDark ? '#87C7FF' : '#007AFF'} />
                    <ThemedText style={[styles.ctaBadgeText, { color: isDark ? '#87C7FF' : '#007AFF' }]}>LAUNCHING SOON</ThemedText>
                  </View>

                  <ThemedText type="title" style={[styles.waitlistTitle, { fontSize: isMobile ? 28 : 44, color: isDark ? '#EAF2FF' : '#0F172A' }]}>Join the Revolution</ThemedText>
                  <ThemedText style={[styles.waitlistSubtitle, { fontSize: isMobile ? 16 : 18, color: isDark ? '#A9B7D9' : '#475569' }]}>Be among the first to experience AI‑powered automation</ThemedText>

                  <View style={[styles.formContainer, { maxWidth: isMobile ? '100%' : 520 }]}>
                    <View style={styles.inputWrapper}>
                      <IconSymbol name="envelope" size={20} color={isDark ? '#8E8E93' : '#64748B'} style={styles.inputIcon} />
                      <TextInput
                        style={[
                          styles.emailInput,
                          {
                            backgroundColor: isDark ? 'rgba(44,44,46,0.6)' : '#F1F5F9',
                            color: isDark ? '#ECF2FF' : '#0F172A',
                            borderColor: isDark ? '#2F3B52' : '#E2E8F0',
                          },
                        ]}
                        placeholder="Enter your email address"
                        placeholderTextColor={isDark ? '#9AA7C7' : '#94A3B8'}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                        accessibilityLabel="Email Address"
                        returnKeyType="send"
                        onSubmitEditing={handleJoinWaitlist}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.joinButton, { opacity: isLoading || !email ? 0.6 : 1 }]}
                      onPress={handleJoinWaitlist}
                      disabled={isLoading || !email}
                      accessibilityRole="button"
                      accessibilityLabel="Join the waitlist"
                    >
                      <LinearGradient colors={isDark ? ['#87C7FF', '#4A9EFF'] : ['#007AFF', '#0051D5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                        {isLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <ThemedText style={styles.joinButtonText}>Join the Waitlist</ThemedText>
                            <IconSymbol name="arrow.right" size={20} color="#fff" />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.privacyBadge}>
                    <IconSymbol name="lock.fill" size={14} color={isDark ? '#87C7FF' : '#007AFF'} />
                    <ThemedText style={[styles.privacyText, { color: isDark ? '#9FB2DB' : '#64748B' }]}>No spam, ever. Unsubscribe anytime.</ThemedText>
                  </View>
                </LinearGradient>
              </Animated.View>
            </Animated.View>

            {/* Footer */}
            <Animated.View entering={FadeIn.duration(700).delay(2300)} style={styles.footerSection}>
              <View style={[styles.footerDivider, { backgroundColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.25)' }]} />
              <ThemedText style={[styles.footerText, { color: isDark ? '#A9B7D9' : '#64748B' }]}>Built with ❤️ using Claude Sonnet 4 & React Native</ThemedText>
              <ThemedText style={[styles.footerSubtext, { color: isDark ? '#91A3CC' : '#94A3B8' }]}>© 2025 Bridge AI. All rights reserved.</ThemedText>
            </Animated.View>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  keyboardView: { flex: 1 },
  scrollContent: { paddingVertical: 56 },
  contentWrapper: { width: '100%' },

  // Background blobs
  blob: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 200,
    backgroundColor: 'rgba(124, 58, 237, 0.25)', // violet
    filter: Platform.OS === 'web' ? 'blur(80px)' : undefined,
  },
  blobAlt: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 200,
    backgroundColor: 'rgba(0, 122, 255, 0.25)',
    right: 0,
    filter: Platform.OS === 'web' ? 'blur(80px)' : undefined,
  },

  // Hero
  heroSection: { alignItems: 'center', marginBottom: 72 },
  orbContainer: { marginBottom: 36 },
  titleContainer: { alignItems: 'center', marginBottom: 14 },
  titleGradient: { borderRadius: 18, paddingHorizontal: 28, paddingVertical: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  heroTitle: { fontSize: 56, fontWeight: '800', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 22, fontWeight: '700', opacity: 0.95, textAlign: 'center' },
  taglineContainer: { paddingHorizontal: 20, alignItems: 'center' },
  tagline: { fontSize: 18, opacity: 0.8, textAlign: 'center', lineHeight: 28 },

  // Stats
  statsSection: { gap: 16, marginBottom: 88 },
  statCard: {
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  statIconContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  statNumber: { fontSize: 40, fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 },
  statLabel: { fontSize: 15, fontWeight: '700', opacity: 0.7 },

  // Features
  featuresSection: { marginBottom: 92 },
  sectionTitle: { fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  sectionSubtitle: { fontSize: 18, textAlign: 'center', marginBottom: 40 },
  featuresGrid: { flexWrap: 'wrap', gap: 22 },
  featureCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  featureIconContainer: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  featureTitle: { fontSize: 20, marginBottom: 8 },
  featureDescription: { fontSize: 15, lineHeight: 22 },

  // Integrations
  integrationsSection: { marginBottom: 92, alignItems: 'center' },
  integrationsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 26 },
  integrationCard: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  integrationIconBg: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  integrationName: { fontSize: 14, fontWeight: '700' },

  // Waitlist
  waitlistSection: { marginBottom: 76 },
  waitlistCard: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(135,199,255,0.55)',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  ctaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 18 },
  ctaBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  waitlistTitle: { fontWeight: '800', textAlign: 'center', marginBottom: 12, letterSpacing: -0.2 },
  waitlistSubtitle: { textAlign: 'center', marginBottom: 28, lineHeight: 26 },
  formContainer: { width: '100%', gap: 14 },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 18, top: 18, zIndex: 1 },
  emailInput: { width: '100%', height: 56, borderRadius: 16, paddingLeft: 50, paddingRight: 18, fontSize: 16, borderWidth: 1.5 },
  joinButton: { width: '100%', height: 56, borderRadius: 16, overflow: 'hidden', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 8 },
  buttonGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  joinButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  privacyBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  privacyText: { fontSize: 13 },

  // Footer
  footerSection: { alignItems: 'center', paddingBottom: 40 },
  footerDivider: { width: '100%', height: 1, marginBottom: 24 },
  footerText: { fontSize: 14, textAlign: 'center', marginBottom: 6 },
  footerSubtext: { fontSize: 13, textAlign: 'center' },
});
