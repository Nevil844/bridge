import { GlowingOrb } from '@/components/glowing-orb';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_ENDPOINTS } from '@/config/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { setAccessToken } from '@/utils/api';
import { secureStorage, storage, STORAGE_KEYS } from '@/utils/storage';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Complete web browser authentication when done
WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
  onLoginSuccess?: (user: { id: string; email: string; name: string; picture?: string; plan?: string }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { login: authLogin } = useAuth();
  
  // Use provided callback or auth hook
  const handleLoginSuccess = onLoginSuccess || authLogin;

  const pollForSession = async (state: string) => {
    try {
      console.log('🔄 Polling for OAuth session with state:', state);
      
      // First, test if endpoint is accessible
      try {
        const testResponse = await fetch(`${API_ENDPOINTS.AUTH.GOOGLE_SESSION.replace('/session', '/test')}`);
        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log('✅ Test endpoint accessible:', testData);
        }
      } catch (e) {
        console.warn('⚠️ Test endpoint not accessible:', e);
      }
      
      // Poll for up to 30 seconds (6 attempts, 5 seconds apart)
      for (let i = 0; i < 6; i++) {
        // Wait before first attempt too (give backend time to process)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          // Wait 2 seconds before first poll
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        try {
          const response = await fetch(`${API_ENDPOINTS.AUTH.GOOGLE_SESSION}?state=${state}`);
          
          if (response.ok) {
            const session = await response.json();
            console.log('✅ Session found:', session);
            
            // Store userId and complete login
            await storage.setItem(STORAGE_KEYS.USER_ID, session.userId);
            
            // Fetch full user info
            const userResponse = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${session.userId}`);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              handleLoginSuccess({
                id: userData.id,
                email: userData.email,
                name: userData.username || userData.email,
              });
              setIsLoading(false);
              return;
            }
          } else if (response.status === 404) {
            const errorData = await response.json().catch(() => ({}));
            console.log(`⏳ Attempt ${i + 1}/6: Session not ready yet...`);
            if (errorData.debug) {
              console.log('📋 Debug info:', errorData.debug);
            }
            // Continue polling
          } else {
            const errorText = await response.text();
            console.error('❌ Error polling session:', response.status, errorText);
            break;
          }
        } catch (error) {
          console.error('❌ Error polling session:', error);
        }
      }
      
      // If we get here, polling failed
      console.log('⚠️ Polling timeout - session not found');
      setIsLoading(false);
      Alert.alert(
        'Login Timeout',
        'Unable to verify login. Please try again and make sure to complete the login in the browser.',
        [
          {
            text: 'OK',
            onPress: () => {
              setIsLoading(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error polling for session:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to verify login. Please try again.');
    }
  };

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking auth status...');
      
      // Check secure storage for OAuth data (works on both web and mobile)
      const oauthUserId = await secureStorage.getItem(STORAGE_KEYS.OAUTH_USER_ID);
      const oauthState = await secureStorage.getItem(STORAGE_KEYS.OAUTH_STATE);
      
      if (oauthUserId && oauthUserId !== 'default-user') {
        console.log('✅ Found userId in secure storage:', oauthUserId);
        await storage.setItem(STORAGE_KEYS.USER_ID, oauthUserId);
        
        // Try to get session using state if available
        if (oauthState) {
          try {
            const sessionResponse = await fetch(`${API_ENDPOINTS.AUTH.GOOGLE_SESSION}?state=${oauthState}`);
            if (sessionResponse.ok) {
              const session = await sessionResponse.json();
              console.log('✅ Session found via secure storage state:', session);
              // Use session userId
              await storage.setItem(STORAGE_KEYS.USER_ID, session.userId);
              
              // Store access token if provided in session
              if (session.accessToken) {
                await setAccessToken(session.accessToken);
                console.log('✅ Access token stored from session');
              }
            }
          } catch (e) {
            console.log('⚠️ Could not fetch session, using secure storage userId');
          }
        }
        
        // Fetch access token if not already stored
        try {
          const tokenResponse = await fetch(`${API_ENDPOINTS.AUTH.TOKEN}?userId=${oauthUserId}`);
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData.accessToken) {
              await setAccessToken(tokenData.accessToken);
              console.log('✅ Access token stored');
            }
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch access token:', e);
        }
        
        const userResponse = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${oauthUserId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
            handleLoginSuccess({
              id: userData.id,
              email: userData.email,
              name: userData.username || userData.email,
              plan: userData.plan || 'free',
            });
          setIsLoading(false);
          // Clear secure storage
          await secureStorage.removeItem(STORAGE_KEYS.OAUTH_USER_ID);
          await secureStorage.removeItem(STORAGE_KEYS.OAUTH_EMAIL);
          await secureStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
          return;
        }
      }
      
      // Wait a bit for backend to process OAuth
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // First, check if we have a stored userId
      let storedUserId = await storage.getItem(STORAGE_KEYS.USER_ID);
      console.log('📱 Stored userId:', storedUserId);
      
      // If no stored userId, try to get the most recent user by checking the backend
      // This is a workaround - in production you'd use session tokens
      if (!storedUserId || storedUserId === 'default-user') {
        console.log('⚠️ No stored userId, trying to find user from recent OAuth...');
        // The backend should have just created a user, but we don't have a way to identify them
        // without the userId from the callback. So we'll show an error.
        setIsLoading(false);
        Alert.alert(
          'Login Incomplete',
          'Unable to retrieve user information. Please try logging in again and make sure to complete the process in the browser.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsLoading(false);
              },
            },
          ]
        );
        return;
      }
      
      // We have a stored userId, fetch access token and user info
      console.log('✅ Found stored userId, fetching access token and user info...');
      
      // Fetch access token
      try {
        const tokenResponse = await fetch(`${API_ENDPOINTS.AUTH.TOKEN}?userId=${storedUserId}`);
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.accessToken) {
            await setAccessToken(tokenData.accessToken);
            console.log('✅ Access token stored');
          }
        }
      } catch (e) {
        console.warn('⚠️ Could not fetch access token:', e);
      }
      
      const userResponse = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${storedUserId}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('✅ User data retrieved:', userData);
        onLoginSuccess({
          id: userData.id,
          email: userData.email,
          name: userData.username || userData.email,
        });
        setIsLoading(false);
        return;
      } else {
        const errorText = await userResponse.text();
        console.error('❌ Failed to fetch user:', userResponse.status, errorText);
        // Clear invalid userId
        await storage.removeItem(STORAGE_KEYS.USER_ID);
      }
      
      // If we get here, login didn't complete properly
      console.log('⚠️ Login verification failed');
      setIsLoading(false);
      Alert.alert(
        'Login Incomplete',
        'Unable to verify login. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              setIsLoading(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to verify login status. Please try again.');
    }
  };

  const handleAuthCallback = async (callbackUrl: string) => {
    try {
      console.log('🔗 Handling auth callback URL:', callbackUrl);
      
      // Extract user info from callback URL
      let url: URL;
      try {
        url = new URL(callbackUrl);
      } catch (e) {
        console.error('Failed to parse URL:', callbackUrl, e);
        // Try to extract from string manually
        const match = callbackUrl.match(/[?&](success|email|userId)=([^&]+)/g);
        if (match) {
          const params: Record<string, string> = {};
          match.forEach(param => {
            const [key, value] = param.substring(1).split('=');
            params[key] = decodeURIComponent(value);
          });
          
          if (params.success === 'true' && params.userId) {
            await storage.setItem(STORAGE_KEYS.USER_ID, params.userId);
            const userResponse = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${params.userId}`);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              handleLoginSuccess({
                id: userData.id,
                email: userData.email,
                name: userData.username || userData.email,
              });
              setIsLoading(false);
              return;
            }
          }
        }
        await checkAuthStatus();
        return;
      }
      
      const success = url.searchParams.get('success');
      const email = url.searchParams.get('email');
      const userId = url.searchParams.get('userId');
      
      console.log('📋 Extracted params:', { success, email, userId });
      
      if (success === 'true' && userId) {
        // We have the user ID directly from the callback
        console.log('✅ Found userId in callback:', userId);
        await storage.setItem(STORAGE_KEYS.USER_ID, userId);
        
        // Fetch access token and user info
        const tokenResponse = await fetch(`${API_ENDPOINTS.AUTH.TOKEN}?userId=${userId}`);
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.accessToken) {
            // Store access token securely
            const { setAccessToken } = require('@/utils/api');
            await setAccessToken(tokenData.accessToken);
            console.log('✅ Access token stored');
          }
        }
        
        // Fetch full user info
        const userResponse = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log('✅ User data fetched:', userData);
            handleLoginSuccess({
              id: userData.id,
              email: userData.email,
              name: userData.username || userData.email,
              plan: userData.plan || 'free',
            });
          setIsLoading(false);
          return;
        } else {
          console.error('❌ Failed to fetch user data:', userResponse.status);
        }
      } else if (email) {
        // Fallback: use email to find user
        console.log('📧 Using email to find user:', email);
        const userResponse = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${encodeURIComponent(email)}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          await storage.setItem(STORAGE_KEYS.USER_ID, userData.id);
            handleLoginSuccess({
              id: userData.id,
              email: userData.email,
              name: userData.username || userData.email,
              plan: userData.plan || 'free',
            });
          setIsLoading(false);
          return;
        }
      }
      
      console.log('⚠️ No user info in callback URL, checking auth status...');
      // If no user info in URL, poll backend
      await checkAuthStatus();
    } catch (error) {
      console.error('❌ Error handling auth callback:', error);
      setIsLoading(false);
      Alert.alert('Login Error', 'Failed to complete login. Please try again.');
    }
  };

  useEffect(() => {
    // For web mode, check if we're already on the callback page
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      if (currentUrl.includes('/api/auth/google/callback')) {
        console.log('🌐 App loaded on callback page, processing...');
        handleAuthCallback(currentUrl).catch(console.error);
      }
    }

    // Listen for deep links (when OAuth callback completes)
    const handleDeepLink = async (event: { url: string }) => {
      try {
        const url = new URL(event.url);
        if (url.pathname.includes('auth/google/callback')) {
          // OAuth callback received, check auth status
          await handleAuthCallback(event.url);
        }
      } catch (e) {
        console.error('Error handling deep link:', e);
      }
    };

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);

      // MOBILE TEST MODE: Auto-login with existing user credentials
      // Skip OAuth flow on mobile for testing
      // Platform-specific test emails: iOS = nevil, Android = kushal
      const TEST_EMAIL = Platform.OS === 'ios' 
        ? 'neviljobanputra34@gmail.com' 
        : Platform.OS === 'android' 
        ? 'kushalnandha26@gmail.com' 
        : null;
      const IS_MOBILE = Platform.OS !== 'web';
      
      if (IS_MOBILE && TEST_EMAIL) {
        console.log(`📱 MOBILE TEST MODE (${Platform.OS}): Auto-logging in with`, TEST_EMAIL);
        
        try {
          // Fetch user by email from backend
          const userResponse = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${TEST_EMAIL}`);
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('✅ Test user loaded:', userData);
            
            // Check if user is invited (invite-only mode)
            const inviteCheck = await fetch(`${API_ENDPOINTS.WAITLIST}/check?email=${encodeURIComponent(TEST_EMAIL)}`);
            if (inviteCheck.ok) {
              const inviteData = await inviteCheck.json();
              if (!inviteData.isInvited) {
                Alert.alert(
                  'Access Restricted',
                  'This app is currently invite-only. Please join the waitlist and wait for an invitation.',
                  [{ text: 'OK' }]
                );
                setIsLoading(false);
                return;
              }
            }
            
            // Store user ID
            await storage.setItem(STORAGE_KEYS.USER_ID, userData.id);
            
            // Call login success callback
            onLoginSuccess({
              id: userData.id,
              email: userData.email,
              name: userData.username || userData.email,
              picture: userData.picture || undefined,
              plan: userData.plan || 'free',
            });
            
            setIsLoading(false);
            return;
          } else {
            console.warn('⚠️ Test user not found, falling back to OAuth');
            // Fall through to normal OAuth flow
          }
        } catch (error) {
          console.error('❌ Error in test mode login:', error);
          // Fall through to normal OAuth flow
        }
      }

      // Normal OAuth flow (web or if test mode fails)
      console.log('🌐 Starting OAuth flow...');

      // Get OAuth URL from backend
      const response = await fetch(API_ENDPOINTS.AUTH.GOOGLE_URL);
      const data = await response.json();
      
      console.log('🔗 OAuth URL response:', {
        hasAuthUrl: !!data.authUrl,
        state: data.state,
      });

      if (!data.authUrl) {
        throw new Error(data.error || 'Failed to get Google login URL');
      }

      // Store the state so we can poll for completion
      const oauthState = data.state;
      console.log('🔑 OAuth state:', oauthState);

      // Open browser for OAuth using openAuthSessionAsync
      const result = await WebBrowser.openAuthSessionAsync(
        data.authUrl,
        API_ENDPOINTS.AUTH.GOOGLE_CALLBACK
      );

      console.log('🌐 OAuth result:', result.type, result.url ? 'has URL' : 'no URL');
      if (result.url) {
        console.log('📋 Callback URL:', result.url);
      }
      
      if (result.type === 'success' && result.url) {
        // Parse the callback URL to extract user info
        console.log('✅ OAuth success, processing callback...');
        await handleAuthCallback(result.url);
      } else if (result.type === 'cancel') {
        console.log('❌ User cancelled OAuth');
        Alert.alert('Login Cancelled', 'You cancelled the login process.');
        setIsLoading(false);
      } else if (result.type === 'dismiss') {
        // Browser was dismissed - check if we're on the callback page (web mode)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const currentUrl = window.location.href;
          console.log('🌐 Current URL after dismiss:', currentUrl);
          
          if (currentUrl.includes('/api/auth/google/callback')) {
            // We're on the callback page, extract user info
            console.log('✅ Found callback URL in window.location');
            await handleAuthCallback(currentUrl);
            return;
          }
        }
        
        // Poll for session completion
        console.log('⚠️ Browser dismissed, polling for session...');
        await pollForSession(oauthState);
      } else {
        // Try to poll for session anyway
        console.log('⚠️ OAuth result type:', result.type, '- polling for session...');
        await pollForSession(oauthState);
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      
      let errorMessage = error.message || 'Failed to login with Google. Please try again.';
      
      // Provide helpful error messages for common issues
      if (errorMessage.includes('redirect_uri') || errorMessage.includes('OAuth 2.0 policy')) {
        errorMessage = 'OAuth redirect URI not registered. Please add http://localhost:3000/api/auth/google/callback to Google Cloud Console. See backend/GOOGLE_OAUTH_SETUP.md for instructions.';
      }
      
      Alert.alert(
        'Login Failed',
        errorMessage,
        [
          { text: 'OK' },
          {
            text: 'Setup Guide',
            onPress: () => {
              // Could open a help screen or documentation
              console.log('See backend/GOOGLE_OAUTH_SETUP.md for setup instructions');
            },
          },
        ]
      );
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.orbContainer}>
            <GlowingOrb />
          </View>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.titleLine1}>Welcome to</ThemedText>
            <Text style={[
              styles.titleLine2,
              { color: isDark ? '#4A9EFF' : '#007AFF' }
            ]}>
              Bridge AI
            </Text>
          </View>
          <ThemedText style={styles.subtitle}>
            Sign in with Google to get started
          </ThemedText>
        </View>

        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.buttonDisabled]}
          onPress={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Image
                source={{ uri: 'https://www.google.com/favicon.ico' }}
                style={styles.googleIcon}
              />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <ThemedText style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text
              style={[styles.linkText, { color: isDark ? '#4A9EFF' : '#007AFF' }]}
              onPress={() => router.push('/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={[styles.linkText, { color: isDark ? '#4A9EFF' : '#007AFF' }]}
              onPress={() => router.push('/privacy')}
            >
              Privacy Policy
            </Text>
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  orbContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  titleLine1: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 40,
  },
  titleLine2: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});

