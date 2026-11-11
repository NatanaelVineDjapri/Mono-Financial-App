// Overview header, 64 high below the status bar: the MONO mark and wordmark on the left;
// a notification bell (no function yet) and the round avatar that opens /more on the
// right. Both buttons are 44.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { moreTitle, notificationsLabel } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const HEADER_HEIGHT = 64;
const BUTTON = 44;
const MARK_HEIGHT = 26;
const MARK_ASPECT = 219 / 222; // assets/brand/mono-mark.png
const WORDMARK_HEIGHT = 14;
const WORDMARK_ASPECT = 499 / 110; // assets/brand/mono-wordmark.png

export interface OverviewHeaderProps {
  initial: string; // first letter of the nickname
  onAvatarPress: () => void;
  onBellPress?: () => void;
}

export function OverviewHeader({ initial, onAvatarPress, onBellPress }: OverviewHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top }]} testID="overview-header">
      {/* Plain RN Image (not expo-image): the two PNGs are tiny bundled assets, and a
          missing logo here left an empty gap at the header's left. */}
      <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="MONO">
        <Image
          source={require('@/assets/brand/mono-mark.png')}
          style={{ height: MARK_HEIGHT, width: MARK_HEIGHT * MARK_ASPECT }}
          resizeMode="contain"
        />
        <Image
          source={require('@/assets/brand/mono-wordmark.png')}
          style={{ height: WORDMARK_HEIGHT, width: WORDMARK_HEIGHT * WORDMARK_ASPECT }}
          resizeMode="contain"
        />
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onBellPress}
          accessibilityRole="button"
          accessibilityLabel={notificationsLabel()}
          android_ripple={undefined}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          testID="overview-bell"
        >
          <Icon name="bell" size={22} color={MonoColors.text} />
        </Pressable>
        <Pressable
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel={moreTitle()}
          android_ripple={undefined}
          style={({ pressed }) => [styles.button, styles.avatar, pressed && styles.pressed]}
          testID="overview-more-avatar"
        >
          <Text style={styles.initial}>{initial}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { backgroundColor: MonoColors.raised, borderWidth: 1, borderColor: MonoColors.border },
  pressed: { opacity: 0.7 },
  initial: { ...MonoText.titleM, color: MonoColors.text },
});
