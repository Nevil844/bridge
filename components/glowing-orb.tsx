import { useColorScheme } from '@/hooks/use-color-scheme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

interface GlowingOrbProps {
  isActive?: boolean;
}

export function GlowingOrb({ isActive = false }: GlowingOrbProps) {
  const colorScheme = useColorScheme();
  
  // Multiple wave layers with different speeds and scales
  const wave1 = useSharedValue(1);
  const wave2 = useSharedValue(1);
  const wave3 = useSharedValue(1);
  const wave4 = useSharedValue(1);
  const wave5 = useSharedValue(1);
  const wave6 = useSharedValue(1);
  
  const rotate1 = useSharedValue(0);
  const rotate2 = useSharedValue(0);
  const opacity1 = useSharedValue(0.3);
  const opacity2 = useSharedValue(0.4);
  const opacity3 = useSharedValue(0.5);

  useEffect(() => {
    // Wave animations with varying speeds and patterns
    wave1.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1800, easing: Easing.bezier(0.45, 0.05, 0.55, 0.95) }),
        withTiming(0.9, { duration: 1600, easing: Easing.bezier(0.45, 0.05, 0.55, 0.95) }),
        withTiming(1, { duration: 1400, easing: Easing.bezier(0.45, 0.05, 0.55, 0.95) })
      ),
      -1,
      false
    );

    wave2.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 2100, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
        withTiming(1.35, { duration: 1900, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
        withTiming(1, { duration: 1700, easing: Easing.bezier(0.42, 0, 0.58, 1) })
      ),
      -1,
      false
    );

    wave3.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 2400, easing: Easing.bezier(0.4, 0.2, 0.6, 0.8) }),
        withTiming(1, { duration: 2000, easing: Easing.bezier(0.4, 0.2, 0.6, 0.8) }),
        withTiming(1.15, { duration: 1800, easing: Easing.bezier(0.4, 0.2, 0.6, 0.8) })
      ),
      -1,
      false
    );

    wave4.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.bezier(0.5, 0, 0.5, 1) }),
        withTiming(1.3, { duration: 2200, easing: Easing.bezier(0.5, 0, 0.5, 1) }),
        withTiming(0.95, { duration: 1900, easing: Easing.bezier(0.5, 0, 0.5, 1) })
      ),
      -1,
      false
    );

    wave5.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 2600, easing: Easing.bezier(0.35, 0.1, 0.65, 0.9) }),
        withTiming(0.9, { duration: 2300, easing: Easing.bezier(0.35, 0.1, 0.65, 0.9) }),
        withTiming(1.1, { duration: 2000, easing: Easing.bezier(0.35, 0.1, 0.65, 0.9) })
      ),
      -1,
      false
    );

    wave6.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 2800, easing: Easing.bezier(0.48, 0.02, 0.52, 0.98) }),
        withTiming(1.25, { duration: 2400, easing: Easing.bezier(0.48, 0.02, 0.52, 0.98) }),
        withTiming(1, { duration: 2100, easing: Easing.bezier(0.48, 0.02, 0.52, 0.98) })
      ),
      -1,
      false
    );

    // Counter-rotating gradients
    rotate1.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );

    rotate2.value = withRepeat(
      withTiming(-360, { duration: 15000, easing: Easing.linear }),
      -1,
      false
    );

    // Pulsing opacities
    opacity1.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    opacity2.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    opacity3.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ scale: wave1.value }],
    opacity: opacity1.value * 0.4,
  }));

  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ scale: wave2.value }],
    opacity: opacity1.value * 0.45,
  }));

  const wave3Style = useAnimatedStyle(() => ({
    transform: [{ scale: wave3.value }],
    opacity: opacity2.value * 0.5,
  }));

  const wave4Style = useAnimatedStyle(() => ({
    transform: [{ scale: wave4.value }],
    opacity: opacity2.value * 0.55,
  }));

  const wave5Style = useAnimatedStyle(() => ({
    transform: [{ scale: wave5.value }],
    opacity: opacity3.value * 0.6,
  }));

  const wave6Style = useAnimatedStyle(() => ({
    transform: [{ scale: wave6.value }],
    opacity: opacity3.value * 0.65,
  }));

  const rotate1Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate1.value}deg` }],
  }));

  const rotate2Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate2.value}deg` }],
  }));

  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.container}>
      {/* Wave layers - 6 dynamic layers */}
      <Animated.View style={[styles.glowLayer, styles.glowOuter, wave1Style]}>
        <View style={[styles.glowCircle, { 
          backgroundColor: isDark ? 'rgba(74, 158, 255, 0.12)' : 'rgba(0, 122, 255, 0.12)' 
        }]} />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, styles.glowOuter2, wave2Style]}>
        <View style={[styles.glowCircle, { 
          backgroundColor: isDark ? 'rgba(107, 179, 255, 0.15)' : 'rgba(10, 132, 255, 0.15)' 
        }]} />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, styles.glowMiddle, wave3Style]}>
        <View style={[styles.glowCircle, { 
          backgroundColor: isDark ? 'rgba(135, 199, 255, 0.18)' : 'rgba(52, 152, 255, 0.18)' 
        }]} />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, styles.glowMiddle2, wave4Style]}>
        <View style={[styles.glowCircle, { 
          backgroundColor: isDark ? 'rgba(74, 158, 255, 0.2)' : 'rgba(0, 122, 255, 0.2)' 
        }]} />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, styles.glowInner, wave5Style]}>
        <View style={[styles.glowCircle, { 
          backgroundColor: isDark ? 'rgba(107, 179, 255, 0.22)' : 'rgba(10, 132, 255, 0.22)' 
        }]} />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, styles.glowInner2, wave6Style]}>
        <View style={[styles.glowCircle, { 
          backgroundColor: isDark ? 'rgba(135, 199, 255, 0.25)' : 'rgba(52, 152, 255, 0.25)' 
        }]} />
      </Animated.View>

      {/* Counter-rotating gradient rings */}
      <Animated.View style={[styles.gradientRing, rotate1Style]}>
        <LinearGradient
          colors={isDark 
            ? ['rgba(74, 158, 255, 0.5)', 'rgba(135, 199, 255, 0.2)', 'rgba(74, 158, 255, 0.5)']
            : ['rgba(0, 122, 255, 0.5)', 'rgba(52, 152, 255, 0.2)', 'rgba(0, 122, 255, 0.5)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}
        />
      </Animated.View>

      <Animated.View style={[styles.gradientRing2, rotate2Style]}>
        <LinearGradient
          colors={isDark 
            ? ['rgba(135, 199, 255, 0.4)', 'rgba(74, 158, 255, 0.15)', 'rgba(135, 199, 255, 0.4)']
            : ['rgba(52, 152, 255, 0.4)', 'rgba(0, 122, 255, 0.15)', 'rgba(52, 152, 255, 0.4)']
          }
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientFill}
        />
      </Animated.View>

      {/* Core orb with blue-tinted gradient */}
      <View style={styles.coreContainer}>
        <LinearGradient
          colors={isDark 
            ? ['#C0DBFF', '#87C7FF', '#B8D6FF']
            : ['#D0E7FF', '#A8D0FF', '#C8E0FF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.core}
        />
        {/* Inner shine - more subtle */}
        <View style={[styles.shine, { 
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.3)' 
        }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowLayer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  glowOuter: {
    width: 200,
    height: 200,
  },
  glowOuter2: {
    width: 185,
    height: 185,
  },
  glowMiddle: {
    width: 160,
    height: 160,
  },
  glowMiddle2: {
    width: 140,
    height: 140,
  },
  glowInner: {
    width: 120,
    height: 120,
  },
  glowInner2: {
    width: 105,
    height: 105,
  },
  gradientRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  gradientRing2: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  gradientFill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  coreContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 15,
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  shine: {
    position: 'absolute',
    top: 15,
    left: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
  },
});

