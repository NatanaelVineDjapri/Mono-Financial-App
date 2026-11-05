// DESIGN.md sections 8/9/16: bottom navigation, 72 tall plus the bottom safe-area inset,
// 5 items, active = 28x2 bar above the icon in `text` (#F5F5F5). CLAUDE.md rule 5's
// "selected bar" (one of accent's allowed graphics uses) is a bar chart's selected bar,
// not this tab indicator — accent never appears here. Colour never becomes the only
// signal either way: position, the bar and the bold label all say the same thing.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/components/Icon';
import { Icon } from '@/components/Icon';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const BAR_HEIGHT = 72;
const INDICATOR_WIDTH = 28;
const INDICATOR_HEIGHT = 2;
const MIN_TOUCH_TARGET = 48;

export interface TabBarItem {
  key: string;
  label: string;
  icon: IconName;
}

export interface TabBarProps {
  items: TabBarItem[];
  activeKey: string;
  onPress: (key: string) => void;
  // The navigator already knows the bottom safe-area inset (BottomTabBarProps.insets) —
  // taking it as a prop keeps this component itself free of a useSafeAreaInsets() call,
  // so a test can set it directly instead of wrapping in a SafeAreaProvider.
  bottomInset?: number;
  testID?: string;
}

export function TabBar({ items, activeKey, onPress, bottomInset = 0, testID }: TabBarProps) {
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[styles.bar, { height: BAR_HEIGHT + bottomInset, paddingBottom: bottomInset }]}
    >
      {items.map(item => {
        const selected = item.key === activeKey;
        const color = selected ? MonoColors.text : MonoColors.textMeta;
        return (
          <Pressable
            key={item.key}
            onPress={() => onPress(item.key)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            android_ripple={undefined}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={styles.iconSlot}>
              {selected && <View style={styles.indicator} testID={testID && `${testID}-indicator`} />}
              <Icon name={item.icon} size={20} color={color} />
            </View>
            <Text style={[MonoText.label, { color }, selected && styles.selectedLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: MonoColors.bg,
    borderTopWidth: 1,
    borderTopColor: MonoColors.border,
  },
  item: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pressed: { backgroundColor: MonoColors.raised },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 20,
  },
  indicator: {
    position: 'absolute',
    top: -10,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    backgroundColor: MonoColors.text,
  },
  // "tebal" (DESIGN.md section 9): the active label steps up from medium to semi-bold.
  selectedLabel: { fontFamily: 'IBMPlexSans_600SemiBold' },
});
