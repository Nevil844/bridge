import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import LandingScreen from './landing';

/**
 * Root index route
 * Shows landing page directly on join subdomain (no redirect)
 * Redirects to tabs on main domain (requires auth)
 */
export default function Index() {
  // On web, check hostname
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If on join subdomain, show landing page directly at root (no redirect)
    if (hostname === 'join.bridge.neviljobanputra.com' || hostname.includes('join.bridge')) {
      return <LandingScreen />;
    }
  }
  
  // Default: redirect to tabs (main app) - will require auth
  return <Redirect href="/(tabs)" />;
}

