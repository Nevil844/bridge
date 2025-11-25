import { CustomAlert } from '@/components/custom-alert';
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
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
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

interface LogoItem {
  name: string;
  logo: string;
}

/**
 * Animated Feature Card Component
 */
function AnimatedFeatureCard({ 
  feature, 
  index, 
  isDark, 
  isMobile, 
  isWeb 
}: { 
  feature: { icon: string; title: string; description: string }; 
  index: number; 
  isDark: boolean; 
  isMobile: boolean; 
  isWeb: boolean;
}) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);
  
  useEffect(() => {
    // Sequential animation - each card animates after the previous one
    const delay = index * 150; // 150ms delay between each card
    
    scale.value = withDelay(
      delay,
      withSpring(1, {
        damping: 12,
        stiffness: 100,
      })
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 400 })
    );
    translateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: 12,
        stiffness: 100,
      })
    );
  }, [index]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));
  
  return (
    <Animated.View
      style={[
        styles.featureCard,
        animatedStyle,
        {
          backgroundColor: isDark ? 'rgba(39,39,42,0.4)' : 'rgba(255,255,255,0.7)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          width: isMobile ? '100%' : isWeb ? '30%' : '48%',
          maxWidth: isWeb ? 350 : undefined,
        },
      ]}
    >
      <View style={[styles.featureIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <IconSymbol name={feature.icon as any} size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
      </View>
      <ThemedText type="defaultSemiBold" style={[styles.featureTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
        {feature.title}
      </ThemedText>
      <ThemedText style={[styles.featureDescription, { color: isDark ? '#A1A1AA' : '#64748B' }]}>
        {feature.description}
      </ThemedText>
    </Animated.View>
  );
}

/**
 * Horizontal scrolling logos carousel component
 */
function AnimatedLogosCarousel({ logos, isDark }: { logos: LogoItem[]; isDark: boolean }) {
  const translateX = useSharedValue(0);
  const logoWidth = 120;
  const logoSpacing = 24;
  
  // Memoize singleSetWidth to prevent unnecessary recalculations
  const singleSetWidth = React.useMemo(
    () => (logoWidth + logoSpacing) * logos.length,
    [logos.length]
  );
  
  useEffect(() => {
    // Cancel any existing animation first to prevent accumulation
    cancelAnimation(translateX);
    
    // Reset to 0 before starting new animation
    translateX.value = 0;
    
    // Create infinite loop animation
    // The animation will automatically reset to 0 after each cycle due to `false` parameter
    translateX.value = withRepeat(
      withTiming(-singleSetWidth, {
        duration: 20000, // 20 seconds for one set
        easing: Easing.linear,
      }),
      -1, // Infinite repeat
      false // Reset to start (0) after each cycle
    );
    
    return () => {
      // Cancel animation on unmount or when dependencies change
      cancelAnimation(translateX);
      translateX.value = 0;
    };
  }, [singleSetWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Duplicate logos 3 times for seamless infinite loop
  // When first set scrolls out, second set is already in view
  const duplicatedLogos = React.useMemo(() => [...logos, ...logos, ...logos], [logos]);

  return (
    <View style={styles.logoScrollWrapper}>
      <Animated.View style={[styles.logoScrollContent, animatedStyle]}>
        {duplicatedLogos.map((logo, index) => (
          <View
            key={`${logo.name}-${index}`}
            style={[
              styles.logoItem,
              {
                width: logoWidth,
                marginRight: logoSpacing,
                backgroundColor: isDark ? 'rgba(28,28,30,0.55)' : 'rgba(255,255,255,0.8)',
                borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.25)',
              },
            ]}
          >
            <Image
              source={{ uri: logo.logo }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export default function LandingScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobile = width < 768;

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

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
    const trimmedEmail = email.trim();
    
    // Validate email - show popup if invalid
    if (!trimmedEmail) {
      showAlert('Enter Valid Email', 'Please enter your email address.', 'error');
      return;
    }
    
    if (!emailRegex.test(trimmedEmail)) {
      showAlert('Enter Valid Email', 'Please enter a valid email address.', 'error');
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
        // Clear email field immediately
        setEmail('');
        // Show success popup
        showAlert('Added to Waitlist', "You've been added to the waitlist!", 'success');
      } else {
        if (data?.error?.includes('already exists')) {
          // Clear email field even if already exists
          setEmail('');
          showAlert('Added to Waitlist', "You're already on our waitlist!", 'success');
        } else {
          showAlert('Error', data?.error || 'Failed to join waitlist. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      showAlert('Connection Error', 'Unable to connect. Please check your internet and try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Times New Roman is a system font, no import needed */}
      
      {/* Clean minimal background */}
      <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: isDark ? '#09090B' : '#FAFAFA',
          }}
        />
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
                <ThemedText 
                  type="title" 
                  style={[
                    styles.heroTitle, 
                    { 
                      fontSize: isMobile ? 48 : 64, 
                      color: isDark ? '#FFFFFF' : '#0F172A',
                      fontFamily: isWeb ? '"Times New Roman", Times, serif' : undefined,
                      fontWeight: isWeb ? '400' : '700',
                      letterSpacing: isWeb ? 1 : 2,
                      marginBottom: 32,
                    }
                  ]}
                >
                  Bridge AI
                </ThemedText>
                <ThemedText style={[styles.heroSubtitle, { color: isDark ? '#A1A1AA' : '#64748B' }]}>
                  Your AI‑Powered Digital Assistant
                </ThemedText>
              </Animated.View>

              <Animated.View entering={FadeIn.duration(900).delay(500)} style={styles.taglineContainer}>
                <ThemedText style={[styles.tagline, { maxWidth: isMobile ? '100%' : 640, color: isDark ? '#D4D4D8' : '#475569' }]}>
                  Connect all your apps, automate your tasks, and unlock the full potential of AI with seamless integrations, advanced memory, and intelligent automation.
                </ThemedText>
              </Animated.View>
            </Animated.View>

            {/* Features */}
            <Animated.View entering={FadeInUp.duration(700).delay(750)} style={styles.featuresSection}>
              <ThemedText type="title" style={[styles.sectionTitle, { fontSize: isMobile ? 28 : 36, color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Powerful Features
              </ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: isDark ? '#A1A1AA' : '#64748B' }]}>
                Everything you need in one intelligent platform
              </ThemedText>

              <View style={[styles.featuresGrid, { 
                flexDirection: isMobile ? 'column' : 'row',
                flexWrap: 'wrap',
                justifyContent: isWeb ? 'space-between' : 'center',
              }]}>
                {[
                  { icon: 'brain', title: 'Advanced Memory', description: 'Semantic search with pgvector for context‑aware conversations' },
                  { icon: 'link', title: 'Smart Integrations', description: 'GitHub, Zomato, Spotify, Zerodha — all connected seamlessly' },
                  { icon: 'gearshape.fill', title: 'Task Automation', description: 'Order food, manage code, trade stocks — all through AI' },
                  { icon: 'shield.fill', title: 'Privacy First', description: 'End‑to‑end encryption with OAuth 2.0 security' },
                  { icon: 'bolt.fill', title: 'Lightning Fast', description: 'Anthropic, OpenAI & Gemini models for instant responses' },
                  { icon: 'sparkles', title: 'Transparent Reasoning', description: 'Explainable, multi‑step task plans' },
                ].map((feature, index) => (
                  <AnimatedFeatureCard
                    key={index}
                    feature={feature}
                    index={index}
                    isDark={isDark}
                    isMobile={isMobile}
                    isWeb={isWeb}
                  />
                ))}
              </View>
            </Animated.View>

            {/* Integrations - Horizontal Scrolling Logos */}
            <Animated.View entering={FadeInUp.duration(700).delay(1700)} style={styles.integrationsSection}>
              <ThemedText type="title" style={[styles.sectionTitle, { fontSize: isMobile ? 28 : 36, color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Works With Your Favorite Apps
              </ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: isDark ? '#A1A1AA' : '#64748B', marginBottom: 32 }]}>
                Seamlessly connect with the tools you use every day
              </ThemedText>
              
              {/* Horizontal Scrolling Logos */}
              <View style={styles.logoScrollContainer}>
                <AnimatedLogosCarousel 
                  logos={[
                    { name: 'GitHub', logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' },
                    { name: 'Google Drive', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Google_Drive_logo.png/240px-Google_Drive_logo.png' },
                    { name: 'Gmail', logo: 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png' },
                    { name: 'Zerodha', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Zerodha_logo.svg/150px-Zerodha_logo.svg.png' },
                    { name: 'Spotify', logo: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png' },
                    { name: 'Zomato', logo: 'https://logo.clearbit.com/zomato.com' },
                    { name: 'Jira', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Jira_Logo.svg/150px-Jira_Logo.svg.png' },
                    { name: 'Slack', logo: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png' },
                    { name: 'Notion', logo: 'https://www.notion.so/images/logo-ios.png' },
                    { name: 'AWS', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Amazon_Web_Services_Logo.svg/300px-Amazon_Web_Services_Logo.svg.png' },
                    { name: 'Discord', logo: 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png' },
                    { name: 'LinkedIn', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/150px-LinkedIn_logo_initials.png' },
                  ]}
                  isDark={isDark}
                />
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
                      style={[styles.joinButton, { opacity: isLoading ? 0.6 : 1 }]}
                      onPress={handleJoinWaitlist}
                      disabled={isLoading}
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
              <ThemedText style={[styles.footerSubtext, { color: isDark ? '#91A3CC' : '#94A3B8' }]}>© 2025 Bridge. All rights reserved.</ThemedText>
            </Animated.View>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />
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
  heroSection: { alignItems: 'center', marginBottom: 80 },
  orbContainer: { marginBottom: 40 },
  titleContainer: { alignItems: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 64, fontWeight: '400', letterSpacing: 2, textAlign: 'center' },
  heroSubtitle: { fontSize: 18, fontWeight: '400', textAlign: 'center' },
  taglineContainer: { paddingHorizontal: 20, alignItems: 'center', marginTop: 24 },
  tagline: { fontSize: 16, textAlign: 'center', lineHeight: 24, fontWeight: '400' },

  // Features
  featuresSection: { marginBottom: 96, width: '100%' },
  sectionTitle: { fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  sectionSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 48, fontWeight: '400' },
  featuresGrid: { 
    flexWrap: 'wrap', 
    gap: 20,
    width: '100%',
  },
  featureCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  featureIconContainer: { 
    width: 48, 
    height: 48, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: { fontSize: 17, marginBottom: 8, fontWeight: '600' },
  featureDescription: { fontSize: 14, lineHeight: 20, fontWeight: '400' },

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
  
  // Logo Carousel
  logoScrollContainer: { width: '100%', overflow: 'hidden', marginTop: 20 },
  logoScrollWrapper: { 
    height: 100, 
    overflow: 'hidden',
    position: 'relative',
  },
  logoScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  logoItem: {
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },

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
