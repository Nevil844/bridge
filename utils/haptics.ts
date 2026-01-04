/**
 * Haptic Feedback Utility
 * Provides consistent haptic feedback across iOS and Android
 * Respects user preference setting
 */

import * as Haptics from 'expo-haptics';
import { storage, STORAGE_KEYS } from './storage';

let hapticsEnabled = true; // Default to enabled

/**
 * Initialize haptics preference from storage
 */
export const initializeHapticsPreference = async () => {
  try {
    const preference = await storage.getItem(STORAGE_KEYS.HAPTICS_ENABLED);
    hapticsEnabled = preference !== 'false'; // Enabled by default
  } catch (error) {
    console.error('Error loading haptics preference:', error);
    hapticsEnabled = true;
  }
};

/**
 * Update haptics preference
 */
export const setHapticsEnabled = async (enabled: boolean) => {
  hapticsEnabled = enabled;
  try {
    await storage.setItem(STORAGE_KEYS.HAPTICS_ENABLED, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving haptics preference:', error);
  }
};

/**
 * Get current haptics preference
 */
export const getHapticsEnabled = () => hapticsEnabled;

/**
 * Light tap feedback - Use for: buttons, taps, selections
 */
export const lightImpact = () => {
  if (hapticsEnabled) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

/**
 * Medium impact feedback - Use for: confirmations, important buttons
 */
export const mediumImpact = () => {
  if (hapticsEnabled) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

/**
 * Heavy impact feedback - Use for: critical actions, errors
 */
export const heavyImpact = () => {
  if (hapticsEnabled) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Success feedback - Use for: successful operations, message sent
 */
export const successFeedback = () => {
  if (hapticsEnabled) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

/**
 * Warning feedback - Use for: warnings, confirmations needed
 */
export const warningFeedback = () => {
  if (hapticsEnabled) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};

/**
 * Error feedback - Use for: errors, failed operations
 */
export const errorFeedback = () => {
  if (hapticsEnabled) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

/**
 * Selection feedback - Use for: picker changes, slider adjustments
 */
export const selectionFeedback = () => {
  if (hapticsEnabled) {
    Haptics.selectionAsync();
  }
};

