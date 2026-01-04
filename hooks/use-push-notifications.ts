/**
 * Push Notifications Hook
 * Automatically registers device token when user is authenticated
 */

import { API_ENDPOINTS } from '@/config/api';
import { authenticatedFetch } from '@/utils/api';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './use-auth';

// Configure notification handler (runs once on import)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Skip web push notifications (requires VAPID keys setup)
    // TODO: Add VAPID keys to app.json for web support
    if (Platform.OS === 'web') {
      console.log('ℹ️ Push notifications on web require VAPID keys setup - skipping for now');
      return;
    }

    // On native, check if it's a physical device (simulators don't support push)
    if (!Device.isDevice) {
      console.warn('⚠️ Push notifications require a physical device');
      return;
    }

    // Register token and send to backend
    (async () => {
      try {
        // Setup Android channel (only for Android)
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        // Request permissions
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          if (newStatus !== 'granted') {
            console.warn('⚠️ Push notification permissions not granted');
            return;
          }
        }

        // Get token
        const projectId = '072b0e6b-d00e-4392-8330-9314b59dfd8b';
        console.log(`[PushNotifications] 📱 Getting Expo push token for project: ${projectId}`);
        
        let token: string;
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync({ 
            projectId,
            // For production builds, ensure we're using the correct experience
            ...(Platform.OS === 'android' && {
              // Android-specific options
            }),
          });
          token = tokenData.data;
          console.log(`[PushNotifications] ✅ Got token: ${token.substring(0, 20)}...`);
        } catch (tokenError: any) {
          console.error('[PushNotifications] ❌ Failed to get Expo push token:', tokenError);
          // Check for common issues
          if (tokenError?.message?.includes('getDevicePushTokenAsync')) {
            console.error('[PushNotifications] ⚠️ This might be a production build issue. Make sure:');
            console.error('  1. Google Services are properly configured');
            console.error('  2. FCM credentials are set up in Expo');
            console.error('  3. The app is signed with the correct keystore');
          }
          throw tokenError;
        }

        // Register with backend
        console.log(`[PushNotifications] 📤 Registering token with backend...`);
        const response = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.REGISTER, {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: Platform.OS,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to register: ${response.status}`);
        }

        const result = await response.json();
        console.log(`[PushNotifications] ✅ Push notifications registered (${Platform.OS})`, result);
      } catch (error) {
        console.error('[PushNotifications] ❌ Push notification registration failed:', error);
        // Log detailed error for debugging
        if (error instanceof Error) {
          console.error('[PushNotifications] Error message:', error.message);
          console.error('[PushNotifications] Error stack:', error.stack);
        }
      }
    })();
  }, [user?.id]);
}

