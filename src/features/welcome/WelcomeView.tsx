// Welcome (first launch, board Welcome): the MONO mark, the mascot, a serif title, three promises, an optional
// nickname and "Mulai". Shown once; "Punya berkas cadangan? Pulihkan" goes to Backup, and when a restore has put
// data on the phone the screen steps aside by itself. No tab bar here, and the system back button leaves the app
// instead of returning to the screen that sent the person here.
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Icon, type IconName } from '@/components/Icon';
import { showToast } from '@/components/toast-store';
import { markAppReady } from '@/core/appReady';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import {
  welcomeBody,
  profileAvatarSub,
  profileAvatarTitle,
  welcomeNicknameHint,
  welcomeNicknameLabel,
  welcomeNicknameOptional,
  welcomeNicknamePlaceholder,
  welcomePromiseCalculated,
  welcomePromiseLocal,
  welcomePromiseNoBank,
  welcomeRestoreA11y,
  welcomeRestoreLink,
  welcomeRestorePrompt,
  welcomeSaveFailed,
  welcomeStart,
  welcomeTitle,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { AvatarPickerSheet } from '@/features/profile/AvatarPickerSheet';
import { ProfileAvatar } from '@/features/profile/ProfileAvatar';
import type { AvatarPoseId } from '@/features/profile/avatarPoses';

import { MascotVideo } from './MascotVideo';
import { useNeedsWelcome } from './useNeedsWelcome';
import { finishWelcome, NICKNAME_MAX_LENGTH } from './welcomeState';

const MARK_ASPECT = 219 / 222; // assets/brand/mono-mark.png
const WORDMARK_ASPECT = 499 / 110; // assets/brand/mono-wordmark.png: width / height

const PROMISES: { icon: IconName; text: () => string }[] = [
  { icon: 'lock', text: welcomePromiseLocal },
  { icon: 'bank', text: welcomePromiseNoBank },
  { icon: 'check', text: welcomePromiseCalculated },
];

export function WelcomeView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const needs = useNeedsWelcome();
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<AvatarPoseId | null>(null);
  const [avatarSheet, setAvatarSheet] = useState(false);

  // Welcome is the first screen of a first launch: once it is up, the brand splash can go (src/core/appReady).
  useEffect(() => {
    if (needs === true) markAppReady();
  }, [needs]);

  // A restore (or anything else) that put data on the phone means there is nothing left to welcome.
  useEffect(() => {
    if (needs === false) router.replace('/(tabs)' as never);
  }, [needs, router]);

  // Back leaves the app: the tabs behind would only send the person straight back here.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, []);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await finishWelcome(db, nickname, avatar);
      await invalidateAfterWrite(queryClient);
      router.replace('/(tabs)' as never);
    } catch {
      showToast(welcomeSaveFailed());
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height" testID="welcome-screen">
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header} accessibilityRole="header" accessibilityLabel="MONO">
          <Image source={require('@/assets/brand/mono-mark.png')} style={{ height: 22, width: 22 * MARK_ASPECT }} contentFit="contain" />
          <Image source={require('@/assets/brand/mono-wordmark.png')} style={styles.wordmark} contentFit="contain" />
        </View>

        <MascotVideo />

        <View style={styles.intro}>
          <Text style={styles.title} accessibilityRole="header">{welcomeTitle()}</Text>
          <Text style={styles.body}>{welcomeBody()}</Text>
        </View>

        <View style={styles.promises}>
          {PROMISES.map(p => (
            <View key={p.icon} style={styles.promise}>
              <Icon name={p.icon} size={18} color={MonoColors.text} />
              <Text style={styles.promiseText}>{p.text()}</Text>
            </View>
          ))}
        </View>

        <View style={styles.nickname}>
          <View style={styles.nicknameHead}>
            <Text style={styles.cap}>{welcomeNicknameLabel()}</Text>
            <Text style={styles.sub}>{welcomeNicknameOptional()}</Text>
          </View>
          <Field
            value={nickname}
            onChangeText={text => setNickname(text.slice(0, NICKNAME_MAX_LENGTH))}
            placeholder={welcomeNicknamePlaceholder()}
            helperText={welcomeNicknameHint()}
            maxLength={NICKNAME_MAX_LENGTH}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={`${welcomeNicknameLabel()}, ${welcomeNicknameOptional()}`}
            testID="welcome-nickname"
          />
        </View>

        <Pressable
          onPress={() => setAvatarSheet(true)}
          accessibilityRole="button"
          accessibilityLabel={`${profileAvatarTitle()}, ${profileAvatarSub()}`}
          android_ripple={undefined}
          style={({ pressed }) => [styles.avatarRow, pressed && styles.avatarRowPressed]}
          testID="welcome-avatar-row"
        >
          <ProfileAvatar poseId={avatar} size={44} />
          <View style={styles.avatarText}>
            <Text style={styles.avatarTitle}>{profileAvatarTitle()}</Text>
            <Text style={styles.sub}>{profileAvatarSub()}</Text>
          </View>
          <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
        </Pressable>

        <View style={styles.actions}>
          <Button label={welcomeStart()} onPress={() => void start()} loading={busy} style={styles.start} testID="welcome-start" />
          <Pressable
            onPress={() => router.push('/backup' as never)}
            accessibilityRole="link"
            accessibilityLabel={welcomeRestoreA11y()}
            android_ripple={undefined}
            style={styles.restore}
            testID="welcome-restore"
          >
            <Text style={styles.restoreText}>{welcomeRestorePrompt()} </Text>
            <Text style={styles.restoreLink}>{welcomeRestoreLink()}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <AvatarPickerSheet
        visible={avatarSheet}
        selected={avatar}
        onSelect={id => {
          setAvatar(id);
          setAvatarSheet(false);
        }}
        onClose={() => setAvatarSheet(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { flexGrow: 1 },
  header: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { height: 13, width: 13 * WORDMARK_ASPECT },
  intro: { paddingHorizontal: 16, paddingTop: 16, alignItems: 'center' },
  title: { ...MonoText.titleL, color: MonoColors.text, textAlign: 'center' },
  body: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  promises: { paddingHorizontal: 32, paddingTop: 16 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 30 },
  promiseText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
  nickname: { paddingHorizontal: 16, paddingTop: 20, gap: 6 },
  nicknameHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginHorizontal: 2 },
  cap: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  avatarRow: { marginHorizontal: 16, marginTop: 16, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.surface },
  avatarRowPressed: { opacity: 0.85 },
  avatarText: { flex: 1 },
  avatarTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  actions: { paddingHorizontal: 16, paddingTop: 20, alignItems: 'center' },
  start: { alignSelf: 'stretch' },
  restore: { minHeight: 44, flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  restoreText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  restoreLink: { ...MonoText.bodyS, color: MonoColors.text, textDecorationLine: 'underline' },
});
