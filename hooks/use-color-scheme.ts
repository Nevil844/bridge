import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { storage } from '@/utils/storage';

const STORAGE_KEY_THEME = 'preference_theme';

/**
 * Respects user's theme preference stored in storage
 */
export function useColorScheme() {
  const [storedTheme, setStoredTheme] = useState<'light' | 'dark' | 'system' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const systemColorScheme = useRNColorScheme();

  const loadTheme = async () => {
    try {
      const saved = await storage.getItem(STORAGE_KEY_THEME);
      if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
        setStoredTheme(saved);
      } else {
        setStoredTheme(null);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTheme();
  }, []);

  // Listen for storage changes (when theme is updated)
  useEffect(() => {
    const checkTheme = async () => {
      try {
        const saved = await storage.getItem(STORAGE_KEY_THEME);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setStoredTheme(saved);
        } else {
          setStoredTheme(null);
        }
      } catch (error) {
        // Ignore errors
      }
    };

    // Check periodically for theme changes (simple polling approach)
    const interval = setInterval(checkTheme, 300);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return systemColorScheme || 'dark';
  }

  // If user has set a preference, use it (unless it's 'system')
  if (storedTheme === 'light') {
    return 'light';
  }
  if (storedTheme === 'dark') {
    return 'dark';
  }
  // If 'system' or no preference, use system color scheme
  return systemColorScheme || 'dark';
}
