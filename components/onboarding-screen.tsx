import { GlowingOrb } from '@/components/glowing-orb';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OnboardingScreenProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingScreen({ visible, onComplete }: OnboardingScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0: orb only, 1: welcome text, 2: complete
  
  const orbOpacity = useRef(new Animated.Value(1)).current;
  const orbScale = useRef(new Animated.Value(1.5)).current; // Bigger orb initially
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTranslateY = useRef(new Animated.Value(20)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const bridgeGlow = useRef(new Animated.Value(0)).current;
  const bridgeTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // Reset animations when hidden
      setStep(0);
      orbOpacity.setValue(1);
      orbScale.setValue(1.5);
      welcomeOpacity.setValue(0);
      welcomeTranslateY.setValue(20);
      screenOpacity.setValue(1);
      bridgeGlow.setValue(0);
      bridgeTranslateY.setValue(0);
      return;
    }

    // Start with glowing orb animation
    if (step === 0) {
      // Pulse animation for orb (bigger scale)
      Animated.loop(
        Animated.sequence([
          Animated.timing(orbScale, {
            toValue: 1.6,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(orbScale, {
            toValue: 1.5,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (step === 1) {
      // Glow and up/down animation for "Bridge AI"
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(bridgeGlow, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: false, // Glow needs to be false for shadowColor
            }),
            Animated.timing(bridgeTranslateY, {
              toValue: -8,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(bridgeGlow, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: false,
            }),
            Animated.timing(bridgeTranslateY, {
              toValue: 8,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }
  }, [visible, step, orbOpacity, orbScale, welcomeOpacity, welcomeTranslateY, screenOpacity, bridgeGlow, bridgeTranslateY]);

  const handlePress = () => {
    if (step === 0) {
      // Show welcome text
      setStep(1);
      Animated.parallel([
        Animated.timing(welcomeOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(welcomeTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (step === 1) {
      // Fade out and complete
      setStep(2);
      Animated.parallel([
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(orbOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(welcomeOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete();
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={() => {}} // Prevent back button from closing
      hardwareAccelerated={true}
    >
      <Animated.View style={[styles.container, { 
        opacity: screenOpacity,
        backgroundColor: isDark ? '#000000' : '#FFFFFF',
      }]}>
        <TouchableOpacity
          style={styles.touchable}
          activeOpacity={1}
          onPress={handlePress}
        >
          <View style={styles.content}>
            {/* Glowing Orb */}
            <Animated.View
              style={[
                styles.orbContainer,
                {
                  opacity: orbOpacity,
                  transform: [{ scale: orbScale }],
                },
              ]}
            >
              <GlowingOrb isActive={true} />
            </Animated.View>

            {/* Welcome Text */}
            {step >= 1 && (
              <Animated.View
                style={[
                  styles.welcomeContainer,
                  {
                    opacity: welcomeOpacity,
                    transform: [{ translateY: welcomeTranslateY }],
                  },
                ]}
              >
                <Text style={[styles.welcomeText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  Welcome to
                </Text>
                <Animated.View
                  style={[
                    {
                      transform: [{ translateY: bridgeTranslateY }],
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      {
                        shadowColor: isDark ? '#4A9EFF' : '#007AFF',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: bridgeGlow.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                        shadowRadius: bridgeGlow.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 25],
                        }),
                        elevation: bridgeGlow.interpolate({
                          inputRange: [0, 1],
                          outputRange: [5, 15],
                        }),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bridgeText,
                        {
                          color: isDark ? '#4A9EFF' : '#007AFF',
                        },
                      ]}
                    >
                      Bridge AI
                    </Text>
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            )}

            {/* Tap hint (only on step 0) */}
            {step === 0 && (
              <Animated.View
                style={[
                  styles.hintContainer,
                  {
                    opacity: orbOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.6],
                    }),
                  },
                ]}
              >
                <Text style={[styles.hintText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  Tap to continue
                </Text>
              </Animated.View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  touchable: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  orbContainer: {
    marginBottom: 40,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  bridgeText: {
    fontSize: 42,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.7,
  },
});

