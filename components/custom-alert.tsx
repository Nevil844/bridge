import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  Animated as RNAnimated,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

// Check if we're in Expo Go (Reanimated doesn't work in Expo Go)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Lazy check for Reanimated - only check when component is used, not at module load
let reanimatedCache: any = null;
let reanimatedChecked = false;

function getReanimated() {
  // Skip Reanimated entirely in Expo Go
  if (isExpoGo) {
    return null;
  }
  
  if (reanimatedChecked) {
    return reanimatedCache;
  }
  
  reanimatedChecked = true;
  try {
    // Use a function to delay the require until component render
    // This will only work in development builds, not Expo Go
    reanimatedCache = require('react-native-reanimated');
    return reanimatedCache;
  } catch (e) {
    // Reanimated not available (not properly configured)
    reanimatedCache = null;
    return null;
  }
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  type?: 'success' | 'error' | 'info';
}

export function CustomAlert({ visible, title, message, onClose, type = 'info' }: CustomAlertProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Lazy check for Reanimated
  const reanimated = getReanimated();
  const useReanimated = reanimated !== null;
  
  // Fallback animation using RN Animated API
  const fadeAnim = useRef(new RNAnimated.Value(visible ? 1 : 0)).current;
  
  useEffect(() => {
    if (!useReanimated) {
      RNAnimated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: visible ? 200 : 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim, useReanimated]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'checkmark.circle.fill';
      case 'error':
        return 'exclamationmark.triangle.fill';
      default:
        return 'info.circle.fill';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return isDark ? ['#10B981', '#059669'] : ['#10B981', '#047857'];
      case 'error':
        return isDark ? ['#EF4444', '#DC2626'] : ['#EF4444', '#B91C1C'];
      default:
        return isDark ? ['#3B82F6', '#2563EB'] : ['#3B82F6', '#1D4ED8'];
    }
  };

  const AnimatedView = useReanimated && reanimated ? reanimated.default.View : RNAnimated.View;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {useReanimated && reanimated ? (
          <AnimatedView
            entering={reanimated.FadeIn.duration(200)}
            exiting={reanimated.FadeOut.duration(150)}
            style={styles.container}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <ThemedView
                style={[
                  styles.alertBox,
                  {
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  },
                ]}
              >
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={getColors() as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconGradient}
                  >
                    <IconSymbol name={getIcon() as any} size={32} color="#FFFFFF" />
                  </LinearGradient>
                </View>

                <ThemedText
                  type="title"
                  style={[
                    styles.title,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  {title}
                </ThemedText>

                <ThemedText
                  style={[
                    styles.message,
                    { color: isDark ? '#A1A1AA' : '#64748B' },
                  ]}
                >
                  {message}
                </ThemedText>

                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    },
                  ]}
                  onPress={onClose}
                >
                  <LinearGradient
                    colors={getColors() as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <ThemedText style={styles.buttonText}>OK</ThemedText>
                  </LinearGradient>
                </TouchableOpacity>
              </ThemedView>
            </TouchableOpacity>
          </AnimatedView>
        ) : (
          <AnimatedView
            style={[styles.container, { opacity: fadeAnim }]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <ThemedView
                style={[
                  styles.alertBox,
                  {
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  },
                ]}
              >
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={getColors() as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconGradient}
                  >
                    <IconSymbol name={getIcon() as any} size={32} color="#FFFFFF" />
                  </LinearGradient>
                </View>

                <ThemedText
                  type="title"
                  style={[
                    styles.title,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  {title}
                </ThemedText>

                <ThemedText
                  style={[
                    styles.message,
                    { color: isDark ? '#A1A1AA' : '#64748B' },
                  ]}
                >
                  {message}
                </ThemedText>

                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    },
                  ]}
                  onPress={onClose}
                >
                  <LinearGradient
                    colors={getColors() as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <ThemedText style={styles.buttonText}>OK</ThemedText>
                  </LinearGradient>
                </TouchableOpacity>
              </ThemedView>
            </TouchableOpacity>
          </AnimatedView>
        )}
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
  },
  alertBox: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

