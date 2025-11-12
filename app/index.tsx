import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Root index route
 * Redirects based on subdomain:
 * - join.bridge.neviljobanputra.com -> /landing
 * - bridge.neviljobanputra.com -> /(tabs) (requires auth)
 */
export default function Index() {
  // On web, check hostname and redirect accordingly
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If on join subdomain, redirect to landing page
    if (hostname === 'join.bridge.neviljobanputra.com' || hostname.includes('join.bridge')) {
      return <Redirect href="/landing" />;
    }
  }
  
  // Default: redirect to tabs (main app)
  return <Redirect href="/(tabs)" />;
}

