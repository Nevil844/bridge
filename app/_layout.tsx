import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';

import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import LoginScreen from './login';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  
  // Check if we're on the join subdomain (landing page only, no auth)
  const isJoinSubdomain = Platform.OS === 'web' && typeof window !== 'undefined' && 
    (window.location.hostname === 'join.bridge.neviljobanputra.com' || 
     window.location.hostname.includes('join.bridge'));
  
  // Always call useAuth (React hooks rule), but ignore it for join subdomain
  const { isAuthenticated, isLoading, login } = useAuth();
  
  // Disable auth for testing (set to true to skip login)
  const DISABLE_AUTH_FOR_TESTING = false;

  // On join subdomain, ALWAYS show landing page without any auth checks
  if (isJoinSubdomain) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen 
            name="index"
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="landing" 
            options={{ 
              headerShown: false,
            }} 
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  // For main app (bridge.neviljobanputra.com), require auth
  // Show loading screen while checking authentication
  if (!DISABLE_AUTH_FOR_TESTING && isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Show login screen if not authenticated (and auth is enabled)
  if (!DISABLE_AUTH_FOR_TESTING && !isAuthenticated) {
    return (
      <>
        <LoginScreen onLoginSuccess={login} />
        <StatusBar style="auto" />
      </>
    );
  }

  // Show main app (auth disabled for testing or authenticated)
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="landing" 
          options={{ 
            headerShown: false,
            presentation: 'fullScreenModal',
          }} 
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
