import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import LoginScreen from './login';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, login } = useAuth();
  
  // Disable auth for testing (set to true to skip login)
  const DISABLE_AUTH_FOR_TESTING = false;

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
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
