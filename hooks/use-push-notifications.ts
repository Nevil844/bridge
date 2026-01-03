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

    // On web, check if service workers are supported
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !('serviceWorker' in navigator)) {
      console.warn('⚠️ Push notifications not supported: Service Workers not available');
      return;
    }

    // On native, check if it's a physical device (simulators don't support push)
    if (Platform.OS !== 'web' && !Device.isDevice) {
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
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

        // Register with backend
        await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.REGISTER, {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: Platform.OS,
          }),
        });

        console.log(`✅ Push notifications registered (${Platform.OS})`);
      } catch (error) {
        console.error('❌ Push notification registration failed:', error);
      }
    })();
  }, [user?.id]);
}

