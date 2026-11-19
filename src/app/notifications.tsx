// /notifications — Inbox screen (Notif-Inbox / Notif-Empty boards).
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { Icon } from '@/components/Icon';
import { useDb } from '@/data/db/DbProvider';
import { listNotifications, markAllRead, markRead } from '@/data/repo/notifications';
import { queryKeys, invalidateAfterWrite } from '@/data/queryKeys';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import { renderNotification } from '@/features/notifications/copy';
import type { NotifPayload, NotifRow } from '@/domain/notify/types';
import {
  notifBackHome,
  notifEmptyBody,
  notifEmptyButton,
  notifEmptyTitle,
  notifGroupOlder,
  notifGroupToday,
  notifGroupYesterday,
  notifInboxTitle,
  notifMarkAllRead,
  notifShortDate,
} from '@/i18n';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

function formatDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return notifShortDate(d, m);
}

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function yesterdayStr(): string {
  const d = new Date(Date.now() - 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function iconForKind(kind: string): import('@/components/Icon').IconName {
  switch (kind) {
    case 'daily': return 'pencil';
    case 'bill_due': return 'calendar';
    case 'bill_overdue': return 'alert-circle';
    case 'budget_near': return 'trend';
    case 'budget_over': return 'alert';
    case 'goal_milestone': return 'target';
    case 'backup': return 'archive';
    default: return 'bell';
  }
}

interface Section { title: string; data: NotifRow[] }

function groupByDate(rows: NotifRow[]): Section[] {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const groups: { today: NotifRow[]; yesterday: NotifRow[]; older: NotifRow[] } = { today: [], yesterday: [], older: [] };
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    if (d === today) groups.today.push(r);
    else if (d === yesterday) groups.yesterday.push(r);
    else groups.older.push(r);
  }
  const sections: Section[] = [];
  if (groups.today.length) sections.push({ title: notifGroupToday(), data: groups.today });
  if (groups.yesterday.length) sections.push({ title: notifGroupYesterday(), data: groups.yesterday });
  if (groups.older.length) sections.push({ title: notifGroupOlder(), data: groups.older });
  return sections;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const hideAmounts = useHideAmounts(s => s.hidden);

  const { data: rows = [] } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => listNotifications(db),
  });

  const sections = groupByDate(rows);

  const onMarkAllRead = async () => {
    await markAllRead(db, new Date().toISOString());
    await invalidateAfterWrite(queryClient);
  };

  const onPressItem = async (item: NotifRow) => {
    if (!item.read_at) {
      await markRead(db, item.id, new Date().toISOString());
      await invalidateAfterWrite(queryClient);
    }
    navigateForKind(item.kind, item.payload);
  };

  function navigateForKind(kind: string, payloadStr: string) {
    try {
      const p = JSON.parse(payloadStr) as NotifPayload;
      switch (kind) {
        case 'daily': router.push('/tx/new'); break;
        case 'bill_due':
        case 'bill_overdue': router.push('/recurring'); break;
        case 'budget_near':
        case 'budget_over': router.push('/budgets' as never); break;
        case 'goal_milestone': router.push('/goals'); break;
        case 'backup': router.push('/backup'); break;
      }
    } catch {}
  }

  const unreadCount = rows.filter(r => !r.read_at).length;

  const renderItem = ({ item }: { item: NotifRow }) => {
    const payload = (() => { try { return JSON.parse(item.payload) as NotifPayload; } catch { return { kind: 'daily' } as NotifPayload; } })();
    const rendered = renderNotification(payload, { hideAmounts });
    const isUnread = !item.read_at;
    const timeLabel = item.created_at.slice(0, 10) === todayStr() || item.created_at.slice(0, 10) === yesterdayStr()
      ? formatTimestamp(item.created_at)
      : formatDate(item.created_at.slice(0, 10));

    return (
      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.pressed, isUnread && styles.itemUnread]}
        onPress={() => void onPressItem(item)}
        accessibilityRole="button"
        testID={`notif-item-${item.id}`}
      >
        <View style={[styles.iconWrap, isUnread && styles.iconWrapUnread]}>
          <Icon name={iconForKind(item.kind)} size={18} color={isUnread ? MonoColors.accent : MonoColors.textSecond} />
        </View>
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]} numberOfLines={1}>
              {rendered.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.itemBody} numberOfLines={2}>{rendered.body}</Text>
          <Text style={styles.itemTime}>{timeLabel}</Text>
          {rendered.actionLabel && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => void onPressItem(item)}
              accessibilityRole="button"
            >
              <Text style={styles.actionBtnText}>{rendered.actionLabel}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  if (rows.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]} testID="notifications-screen">
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
              <Icon name="chevron-left" size={20} color={MonoColors.text} />
              <Text style={styles.backLabel}>{notifBackHome()}</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{notifInboxTitle()}</Text>
        </View>
        <View style={styles.empty}>
          <Icon name="bell" size={26} color={MonoColors.textSecond} />
          <Text style={styles.emptyTitle}>{notifEmptyTitle()}</Text>
          <Text style={styles.emptyBody}>{notifEmptyBody()}</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/settings/notifications' as never)}>
            <Text style={styles.emptyBtnText}>{notifEmptyButton()}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Flatten sections for FlatList with section headers
  const flatData: Array<{ type: 'header'; title: string } | { type: 'item'; item: NotifRow }> = [];
  for (const section of sections) {
    flatData.push({ type: 'header', title: section.title });
    for (const item of section.data) flatData.push({ type: 'item', item });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="notifications-screen">
      <FlatList
        data={flatData}
        keyExtractor={(r, i) => r.type === 'item' ? String(r.item.id) : `hdr-${i}`}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
                <Icon name="chevron-left" size={20} color={MonoColors.text} />
                <Text style={styles.backLabel}>{notifBackHome()}</Text>
              </Pressable>
              {unreadCount > 0 && (
                <Pressable onPress={() => void onMarkAllRead()} accessibilityRole="button">
                  <Text style={styles.markAllRead}>{notifMarkAllRead()}</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.title}>{notifInboxTitle()}</Text>
          </View>
        )}
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return <Text style={styles.sectionHeader}>{row.title}</Text>;
          }
          return renderItem({ item: row.item });
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  backLabel: { ...MonoText.body, color: MonoColors.textSecond },
  title: { ...MonoText.titleL, color: MonoColors.text, paddingHorizontal: 16, paddingBottom: 8 },
  markAllRead: { ...MonoText.caption, color: MonoColors.accent },
  sectionHeader: { ...MonoText.caption, color: MonoColors.textSecond, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  item: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  itemUnread: { backgroundColor: MonoColors.surface },
  pressed: { opacity: 0.7 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: MonoColors.raised, alignItems: 'center', justifyContent: 'center' },
  iconWrapUnread: { backgroundColor: MonoColors.card },
  textWrap: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle: { ...MonoText.body, color: MonoColors.textSecond, flex: 1 },
  itemTitleUnread: { ...MonoText.bodyStrong, color: MonoColors.text },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: MonoColors.accent },
  itemBody: { ...MonoText.caption, color: MonoColors.textSecond },
  itemTime: { ...MonoText.caption, color: MonoColors.textMeta, marginTop: 2 },
  actionBtn: { marginTop: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: MonoColors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  actionBtnText: { ...MonoText.caption, color: MonoColors.text },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
  emptyBtn: { marginTop: 8, borderWidth: 1, borderColor: MonoColors.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBtnText: { ...MonoText.body, color: MonoColors.text },
});
