import { useColorScheme } from '@/hooks/use-color-scheme';
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

export function GlowingOrb() {
  const colorScheme = useColorScheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    // Pulsating animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.container}>
      {/* Outer glow layers */}
      <Animated.View
        style={[
          styles.glow,
          styles.glowOuter,
          { backgroundColor: isDark ? '#4A9EFF' : '#007AFF' },
          animatedStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.glow,
          styles.glowMiddle,
          { backgroundColor: isDark ? '#6BB3FF' : '#0A84FF' },
          animatedStyle,
        ]}
      />
      {/* Core orb */}
      <View
        style={[
          styles.core,
          { backgroundColor: isDark ? '#FFFFFF' : '#FFFFFF' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowOuter: {
    width: 120,
    height: 120,
    opacity: 0.2,
  },
  glowMiddle: {
    width: 90,
    height: 90,
    opacity: 0.3,
  },
  core: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
});

