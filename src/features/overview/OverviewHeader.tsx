// Overview header: Avatar with 2-line greeting (greeting phrase & username) on the left,
// notification bell with unread badge dot on the right.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import type { AvatarPoseId } from '@/features/profile/avatarPoses';
import { ProfileAvatar } from '@/features/profile/ProfileAvatar';
import { bellUnreadLabel, moreTitle, notificationsLabel, welcomeGreeting, type GreetingKind } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const HEADER_HEIGHT = 64;

export interface OverviewHeaderProps {
  initial: string; // first letter of the nickname
  avatarPose?: AvatarPoseId | null; // the chosen profile picture; null: the default avatar
  nickname: string;
  greeting: GreetingKind | null;
  onAvatarPress: () => void;
  onBellPress?: () => void;
  unreadCount?: number; // 0 = no badge; >0 = show dot or count
}

export function OverviewHeader({
  initial,
  avatarPose = null,
  nickname,
  greeting,
  onAvatarPress,
  onBellPress,
  unreadCount = 0,
}: OverviewHeaderProps) {
  const insets = useSafeAreaInsets();
  const hasName = nickname.trim().length > 0;
  const greetingPhrase = greeting ? welcomeGreeting(null, greeting) : '';
  const fullGreeting = greeting ? welcomeGreeting(nickname, greeting) : '';

  return (
    <View style={[styles.header, { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top }]} testID="overview-header">
      <View style={styles.left}>
        <Pressable
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel={moreTitle()}
          android_ripple={undefined}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          testID="overview-more-avatar"
        >
          <ProfileAvatar poseId={avatarPose} size={40} />
          <Text style={styles.avatarInitialA11y}>{initial}</Text>
        </Pressable>

        <View style={styles.greetingCol}>
          {hasName && greetingPhrase ? (
            <Text style={styles.greetingSub} numberOfLines={1}>
              {greetingPhrase}
            </Text>
          ) : null}
          <Text style={styles.userName} numberOfLines={1} testID="overview-header-name">
            {hasName ? nickname : greetingPhrase}
          </Text>
          {fullGreeting ? (
            <Text style={styles.greetingA11y} accessibilityRole="header">
              {fullGreeting}
            </Text>
          ) : null}
        </View>
      </View>

      <View accessible accessibilityRole="header" accessibilityLabel="MONO" style={styles.monoA11y} />

      <Pressable
        onPress={onBellPress}
        accessibilityRole="button"
        accessibilityLabel={unreadCount > 0 ? bellUnreadLabel(unreadCount) : notificationsLabel()}
        android_ripple={undefined}
        style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
        testID="overview-bell"
      >
        <Icon name="bell" size={20} color={MonoColors.text} />
        {unreadCount > 0 && (
          unreadCount <= 9
            ? <View style={styles.badgeDot} />
            : (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: MonoColors.raised,
    borderWidth: 1,
    borderColor: MonoColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitialA11y: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
  greetingCol: {
    justifyContent: 'center',
    gap: 1,
    flex: 1,
  },
  greetingSub: {
    ...MonoText.caption,
    fontSize: 12,
    color: MonoColors.textSecond,
  },
  userName: {
    ...MonoText.bodyStrong,
    fontSize: 15,
    color: MonoColors.text,
  },
  greetingA11y: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
  monoA11y: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: MonoColors.raised,
    borderWidth: 1,
    borderColor: MonoColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MonoColors.accent,
    borderWidth: 1.5,
    borderColor: MonoColors.raised,
  },
  badgeCount: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: MonoColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: MonoColors.bg,
    lineHeight: 11,
  },
  pressed: {
    opacity: 0.7,
  },
});
