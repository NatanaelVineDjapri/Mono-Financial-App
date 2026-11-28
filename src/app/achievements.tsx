// Streak and achievements (/achievements, from the flame on Overview and from More): the running streak with the last
// seven days, then the 30 badges; a locked one is dimmed and says how far along it is. A press shows what it takes.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Sheet } from '@/components/Sheet';
import { today as todayLocal } from '@/core/clock';
import { addDays, formatShortDate } from '@/core/date';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getAchievements, type Achievement } from '@/domain/achievements';
import { BADGE_IMAGES } from '@/features/achievements/badges';
import {
  achievementEarned,
  achievementLocked,
  achievementName,
  achievementText,
  achievementsCount,
  achievementsLoadError,
  achievementsTitle,
  backLabel,
  closeLabel,
  retryLabel,
  streakDayLabel,
  streakDays,
  streakLongest,
  streakTodayDone,
  streakTodayOpen,
  streakWeek,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const status = (a: Achievement) => (a.earned ? achievementEarned() : a.progress ? `${a.progress.value} / ${a.progress.target}` : achievementLocked());

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const today = todayLocal();
  const { data, isError, refetch } = useQuery({ queryKey: [...queryKeys.transactions, 'achievements', today], queryFn: () => getAchievements(db, today), staleTime: 0 });
  const [open, setOpen] = useState<Achievement | null>(null);

  const recorded = new Set(data?.days);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const earned = data?.achievements.filter(a => a.earned).length ?? 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={backLabel()} onPress={() => router.back()} testID="achievements-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {achievementsTitle()}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        {isError && (
          <View style={styles.centered}>
            <Text style={styles.sub}>{achievementsLoadError()}</Text>
            <Button label={retryLabel()} onPress={() => void refetch()} />
          </View>
        )}
        {data && (
          <>
            <View style={styles.card} testID="streak-card">
              <View style={styles.streakLine}>
                <Icon name="flame" size={28} color={data.streak.todayDone ? MonoColors.accent : MonoColors.textMeta} />
                <Text style={styles.streak}>{streakDays(data.streak.current)}</Text>
              </View>
              <Text style={styles.sub}>{data.streak.todayDone ? streakTodayDone() : streakTodayOpen()}</Text>
              <Text style={styles.sub}>{streakLongest(data.streak.longest)}</Text>
              <Text style={styles.label}>{streakWeek()}</Text>
              <View style={styles.week}>
                {week.map(day => {
                  const done = recorded.has(day);
                  return (
                    <View key={day} style={styles.day} accessible accessibilityLabel={streakDayLabel(formatShortDate(day), done)} testID={`streak-day-${day}`}>
                      <View style={[styles.dot, done && styles.dotDone]}>{done && <Icon name="check" size={16} color={MonoColors.bg} />}</View>
                      <Text style={styles.dayText}>{Number(day.slice(8))}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text style={styles.label}>{achievementsCount(earned, data.achievements.length)}</Text>
            <View style={styles.grid}>
              {data.achievements.map(a => (
                <Pressable
                  key={a.id}
                  onPress={() => setOpen(a)}
                  accessibilityRole="button"
                  accessibilityLabel={`${achievementName(a.id)}, ${status(a)}`}
                  style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                  testID={`badge-${a.id}`}
                >
                  <Image source={BADGE_IMAGES[a.id - 1]} style={[styles.badge, !a.earned && styles.locked]} fadeDuration={0} />
                  <Text style={[styles.name, !a.earned && styles.nameLocked]}>{achievementName(a.id)}</Text>
                  {!a.earned && a.progress && <Text style={styles.progress}>{status(a)}</Text>}
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Sheet visible={open != null} onClose={() => setOpen(null)} closeLabel={closeLabel()} testID="badge-sheet">
        {open && (
          <View style={styles.detail}>
            <Image source={BADGE_IMAGES[open.id - 1]} style={[styles.bigBadge, !open.earned && styles.locked]} fadeDuration={0} />
            <Text style={styles.detailName}>{achievementName(open.id)}</Text>
            <Text style={styles.detailText}>{achievementText(open.id)}</Text>
            <Text style={styles.label}>{status(open)}</Text>
            <Button label={closeLabel()} variant="secondary" onPress={() => setOpen(null)} testID="badge-sheet-close" />
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  centered: { alignItems: 'center', gap: 12, padding: 32 },
  card: { backgroundColor: MonoColors.surface, borderRadius: 20, borderWidth: 1, borderColor: MonoColors.border, padding: 16, gap: 6 },
  streakLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streak: { ...MonoText.titleL, color: MonoColors.text, flexShrink: 1 },
  sub: { ...MonoText.bodyS, color: MonoColors.textSecond },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase', marginTop: 8 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  day: { alignItems: 'center', gap: 4 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: MonoColors.border, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: MonoColors.accent, borderColor: MonoColors.accent },
  dayText: { ...MonoText.caption, color: MonoColors.textMeta },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  cell: { width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  pressed: { opacity: 0.7 },
  badge: { width: 96, height: 96 },
  locked: { opacity: 0.22 },
  name: { ...MonoText.caption, color: MonoColors.text, textAlign: 'center' },
  nameLocked: { color: MonoColors.textMeta },
  progress: { ...MonoText.caption, color: MonoColors.textMeta },
  detail: { alignItems: 'center', gap: 10, paddingTop: 8 },
  bigBadge: { width: 160, height: 160 },
  detailName: { ...MonoText.titleM, color: MonoColors.text, textAlign: 'center' },
  detailText: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
