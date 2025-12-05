// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // Tab bar icons
  'message.fill': 'message',
  'link': 'link',
  'gearshape.fill': 'settings',
  // Chat screen icons
  'line.3.horizontal': 'menu',
  'square.and.pencil': 'edit',
  'chevron.left': 'chevron-left',
  'trash': 'delete',
  'envelope': 'mail',
  'arrow.right.square': 'send',
  // Settings icons
  'chart.bar': 'bar-chart',
  'gearshape': 'settings',
  'arrow.clockwise': 'refresh',
  'info.circle': 'info',
  // Pricing icons
  'checkmark.circle.fill': 'check-circle',
  // Alert icons
  'exclamationmark.triangle.fill': 'warning',
  'info.circle.fill': 'info',
  // Thinking process icons
  'brain': 'psychology',
  'chevron.up': 'keyboard-arrow-up',
  'chevron.down': 'keyboard-arrow-down',
  // Additional icons
  'mic.fill': 'mic',
  'arrow.up': 'arrow-upward',
  'stop.circle.fill': 'stop-circle',
  'doc.on.doc': 'content-copy',
  'xmark.circle.fill': 'cancel',
  // Landing page icons
  'shield.fill': 'shield',
  'bolt.fill': 'bolt',
  'sparkles': 'auto-awesome',
  'lock.fill': 'lock',
  'arrow.right': 'arrow-forward',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name];
  
  if (!iconName) {
    console.warn(`IconSymbol: No mapping found for "${name}". Using "help" as fallback.`);
    return <MaterialIcons color={color} size={size} name="help" style={style} />;
  }
  
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}
