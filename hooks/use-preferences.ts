import { storage } from '@/utils/storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY_TOOL_APPROVAL = 'preference_tool_approval';
const STORAGE_KEY_THEME = 'preference_theme';

export function usePreferences() {
  const [toolApprovalEnabled, setToolApprovalEnabledState] = useState(false);
  const [themePreference, setThemePreferenceState] = useState<'light' | 'dark' | 'system' | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadPreferences = async () => {
    try {
      const [savedApproval, savedTheme] = await Promise.all([
        storage.getItem(STORAGE_KEY_TOOL_APPROVAL),
        storage.getItem(STORAGE_KEY_THEME),
      ]);
      setToolApprovalEnabledState(savedApproval === 'true');
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        setThemePreferenceState(savedTheme);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  // Listen for storage changes (especially important for web)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_TOOL_APPROVAL) {
        setToolApprovalEnabledState(e.newValue === 'true');
      } else if (e.key === STORAGE_KEY_THEME) {
        if (e.newValue && (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system')) {
          setThemePreferenceState(e.newValue);
        } else {
          setThemePreferenceState(null);
        }
      }
    };

    const handlePreferenceChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value: string }>;
      const key = customEvent.detail?.key;
      const newValue = customEvent.detail?.value;
      
      if (key === STORAGE_KEY_TOOL_APPROVAL) {
        setToolApprovalEnabledState(newValue === 'true');
      } else if (key === STORAGE_KEY_THEME) {
        if (newValue && (newValue === 'light' || newValue === 'dark' || newValue === 'system')) {
          setThemePreferenceState(newValue);
        } else {
          setThemePreferenceState(null);
        }
      }
    };

    // Listen for storage events (cross-tab/window changes)
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom preference change events (same-tab changes)
    window.addEventListener('preferenceChanged', handlePreferenceChange);

    // Also poll periodically to catch any missed changes (fallback)
    const pollInterval = setInterval(() => {
      loadPreferences();
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('preferenceChanged', handlePreferenceChange);
      clearInterval(pollInterval);
    };
  }, []);

  const setToolApprovalEnabled = async (enabled: boolean) => {
    try {
      setToolApprovalEnabledState(enabled);
      await storage.setItem(STORAGE_KEY_TOOL_APPROVAL, enabled ? 'true' : 'false');
      
      // Dispatch custom event for immediate updates (web)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preferenceChanged', {
          detail: { key: STORAGE_KEY_TOOL_APPROVAL, value: enabled ? 'true' : 'false' }
        }));
      }
    } catch (error) {
      console.error('Error saving tool approval preference:', error);
      // Revert on error
      setToolApprovalEnabledState(!enabled);
    }
  };

  const setThemePreference = async (theme: 'light' | 'dark' | 'system') => {
    try {
      setThemePreferenceState(theme);
      await storage.setItem(STORAGE_KEY_THEME, theme);
      
      // Dispatch custom event for immediate updates (web)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preferenceChanged', {
          detail: { key: STORAGE_KEY_THEME, value: theme }
        }));
      }
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  return {
    toolApprovalEnabled: isLoaded ? toolApprovalEnabled : false,
    setToolApprovalEnabled,
    themePreference: isLoaded ? themePreference : null,
    setThemePreference,
    isLoaded,
  };
}

