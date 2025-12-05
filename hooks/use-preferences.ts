import { storage } from '@/utils/storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY_TOOL_APPROVAL = 'preference_tool_approval';
const STORAGE_KEY_THEME = 'preference_theme';

export function usePreferences() {
  const [toolApprovalEnabled, setToolApprovalEnabledState] = useState(false);
  const [themePreference, setThemePreferenceState] = useState<'light' | 'dark' | 'system' | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

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

  const setToolApprovalEnabled = async (enabled: boolean) => {
    try {
      setToolApprovalEnabledState(enabled);
      await storage.setItem(STORAGE_KEY_TOOL_APPROVAL, enabled ? 'true' : 'false');
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

