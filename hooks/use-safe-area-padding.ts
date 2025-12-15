import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SafeAreaPaddingOptions = {
  top?: number;
  bottom?: number;
};

/**
 * Provides safe-area aware top/bottom paddings that work on devices
 * with notches/Dynamic Island and Android cutouts.
 */
export function useSafeAreaPadding(options: SafeAreaPaddingOptions = {}) {
  const { top = 16, bottom = 16 } = options;
  const insets = useSafeAreaInsets();

  // On web we don't get native insets; fall back to the provided defaults.
  const topInset = Platform.OS === 'web' ? top : Math.max(insets.top, top);
  const bottomInset = Platform.OS === 'web' ? bottom : Math.max(insets.bottom, bottom);

  return useMemo(
    () => ({
      topInset,
      bottomInset,
      paddingStyle: { paddingTop: topInset, paddingBottom: bottomInset },
    }),
    [topInset, bottomInset]
  );
}

