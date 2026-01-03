import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { storage } from '@/utils/storage';

const STORAGE_KEY_THEME = 'preference_theme';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 * Also respects user's theme preference stored in storage
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
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
      setHasHydrated(true);
    }
  };

  useEffect(() => {
    loadTheme();
  }, []);

  // Listen for theme changes (web)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleThemeChange = async () => {
      await loadTheme();
    };

    // Listen for custom theme change events
    window.addEventListener('themeChanged', handleThemeChange);
    // Also listen for storage events (in case storage changes elsewhere)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY_THEME) {
        handleThemeChange();
      }
    });

    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  if (!hasHydrated || isLoading) {
    return 'dark';
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
