import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

/**
 * Web/Android icon implementation.
 *
 * We map SF Symbol-style names to Ionicons (which use iOS-style glyphs),
 * so you get an iOS-like look on non-iOS platforms while the `.ios.tsx`
 * version continues to use native SF Symbols.
 */

const MAPPING = {
  // Navigation / layout
  'house.fill': 'home',
  'chevron.right': 'chevron-forward',
  'chevron.left': 'chevron-back',
  'chevron.up': 'chevron-up',
  'chevron.down': 'chevron-down',
  'line.3.horizontal': 'menu',

  // Tabs
  'message.fill': 'chatbubble-ellipses',
  link: 'link',
  'gearshape.fill': 'settings',
  gearshape: 'settings-outline',

  // Chat
  'square.and.pencil': 'create',
  trash: 'trash',
  envelope: 'mail',
  'arrow.right.square': 'arrow-forward-circle',

  // Settings / usage
  'chart.bar': 'stats-chart',
  'arrow.clockwise': 'refresh',
  'info.circle': 'information-circle',
  'info.circle.fill': 'information-circle',

  // Alerts
  'exclamationmark.triangle.fill': 'warning',

  // Thinking / misc
  brain: 'hardware-chip',

  // Recording
  'mic.fill': 'mic',
  'arrow.up': 'arrow-up',
  'stop.circle.fill': 'stop-circle',

  // Copy / close / person
  'doc.on.doc': 'copy',
  'xmark.circle.fill': 'close-circle',
  'person.circle.fill': 'person-circle',
  
  // Search
  'magnifyingglass': 'search',

  // Landing / marketing
  'shield.fill': 'shield',
  'bolt.fill': 'flash',
  sparkles: 'sparkles',
  'lock.fill': 'lock-closed',
  'arrow.right': 'arrow-forward',

  // Pricing
  'checkmark.circle.fill': 'checkmark-circle',
} as const;

type IconName = keyof typeof MAPPING;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color: ComponentProps<typeof Ionicons>['color'];
  style?: StyleProp<TextStyle>;
}) {
  const mapped = MAPPING[name];

  if (!mapped) {
    if (__DEV__) {
      console.warn(`IconSymbol(web/android): No Ionicons mapping for "${name}". Falling back to "help-circle".`);
    }
    return <Ionicons name="help-circle" size={size} color={color} style={style} />;
  }

  return <Ionicons name={mapped} size={size} color={color} style={style} />;
}
