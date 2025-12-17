/**
 * Unified Storage Utility
 * 
 * Handles storage across platforms:
 * - Web: Uses localStorage
 * - Mobile: Uses AsyncStorage (non-sensitive) and SecureStore (sensitive)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Lazy load SecureStore only on mobile
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (e) {
    console.warn('expo-secure-store not available, using AsyncStorage for sensitive data');
  }
}

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  USER_ID: 'userId',
  SELECTED_MODEL: 'selectedModel',
  // OAuth sensitive data (should use SecureStore on mobile)
  OAUTH_USER_ID: 'oauth_userId',
  OAUTH_EMAIL: 'oauth_email',
  OAUTH_STATE: 'oauth_state',
  // Preferences
  TOOL_APPROVAL: 'preference_tool_approval',
  HAPTICS_ENABLED: 'preference_haptics_enabled',
  // Onboarding flow (includes onboarding + disclaimer)
  ONBOARDING_COMPLETED: 'onboarding_completed',
} as const;

/**
 * Non-sensitive storage (works on both web and mobile)
 */
export const storage = {
  /**
   * Get item from storage
   */
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return await AsyncStorage.getItem(key);
  },

  /**
   * Set item in storage
   */
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await AsyncStorage.setItem(key, value);
  },

  /**
   * Remove item from storage
   */
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await AsyncStorage.removeItem(key);
  },

  /**
   * Clear all items
   */
  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
      return;
    }
    await AsyncStorage.clear();
  },
};

/**
 * Secure storage for sensitive data (OAuth tokens, etc.)
 * - Web: Uses localStorage (not truly secure, but works)
 * - Mobile: Uses SecureStore (encrypted)
 */
export const secureStorage = {
  /**
   * Get item from secure storage
   */
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      // Web: use localStorage (not truly secure, but works for OAuth state)
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }

    // Mobile: use SecureStore if available, fallback to AsyncStorage
    if (SecureStore) {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (error) {
        console.warn('SecureStore getItem failed, falling back to AsyncStorage:', error);
        return await AsyncStorage.getItem(key);
      }
    }

    // Fallback to AsyncStorage if SecureStore not available
    return await AsyncStorage.getItem(key);
  },

  /**
   * Set item in secure storage
   */
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Web: use localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }

    // Mobile: use SecureStore if available, fallback to AsyncStorage
    if (SecureStore) {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch (error) {
        console.warn('SecureStore setItem failed, falling back to AsyncStorage:', error);
        await AsyncStorage.setItem(key, value);
        return;
      }
    }

    // Fallback to AsyncStorage if SecureStore not available
    await AsyncStorage.setItem(key, value);
  },

  /**
   * Remove item from secure storage
   */
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Web: use localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }

    // Mobile: use SecureStore if available, fallback to AsyncStorage
    if (SecureStore) {
      try {
        await SecureStore.deleteItemAsync(key);
        return;
      } catch (error) {
        console.warn('SecureStore removeItem failed, falling back to AsyncStorage:', error);
        await AsyncStorage.removeItem(key);
        return;
      }
    }

    // Fallback to AsyncStorage if SecureStore not available
    await AsyncStorage.removeItem(key);
  },
};

