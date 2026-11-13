// Fixed expenses list (PAGES.md L1 / board "Recurring").
// Header: safe-area inset + 56px back row + HeaderRow withTopInset={false}.
// Summary card: figureM (22/28 500) amount, two stat rows.
// Due cards: 1.5px border, #151516 bg, day_of_month label — NOT the day from due_on.
// Confirm sheet unchanged (confirm-first model, CLAUDE.md rule 10).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountField } from '@/components/AmountField';
import { Button } from '@/components/Button';
import { HeaderRow } from '@/components/HeaderRow';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import { today, nowIso } from '@/core/clock';
import { addDays, daysBetween, formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import type { RecurringDueRow } from '@/data/repo/recurring';
import {
  confirmRecurring,
  listRecurring,
  listRecurringDue,
  monthlyRecurringEstimate,
  nextDue,
  skipRecurring,
} from '@/domain/recurring';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import {
  moreBackLabel,
  moreBackText,
  recurringAbout,
  recurringAdd,
  recurringAfter,
  recurringComingUp,
  recurringConfirmDue,
  recurringConfirmTitle,
  recurringDate,
  recurringDay,
  recurringEmpty,
  recurringIntro,
  recurringNeedsConfirmation,
  recurringOverdue,
  recurringRecord,
  recurringRecordNow,
  recurringReminderNote,
  recurringSavedToast,
  recurringSkip,
  recurringSkipNote,
  recurringTitle,
  recurringToday,
  recurringUsualAmount,
  recurringVaries,
} from '@/i18n';

// ─── Due card ────────────────────────────────────────────────────────────────

function DueTag({ dueOn }: { dueOn: string }) {
  const late = daysBetween(dueOn, today());
  const label = late === 0 ? recurringToday() : recurringOverdue(late);
  const icon = late === 0 ? 'alert-circle' : 'alert';
  return (
    <View style={s.tag}>
      <Icon name={icon} size={16} color={MonoColors.textSecond} />
      <Text style={s.tagText}>{label}</Text>
    </View>
  );
}

function DueCard({
  due,
  onRecord,
  onSkip,
}: {
  due: RecurringDueRow;
  onRecord: () => void;
  onSkip: () => void;
}) {
  const hidden = useHideAmounts(st => st.hidden);
  // day_of_month is the template's canonical day — not the day in due_on (the clamped actual date).
  const sub = `${due.category_name} · ${due.account_name} · ${recurringDay(due.day_of_month)}`;
  // Show the actual due date as secondary context when it's overdue.
  const isOverdue = due.due_on < today();
  return (
    <View style={s.dueCard} accessibilityLabel={`${due.name}, ${shown(rp(due.amount), hidden)}, ${isOverdue ? recurringOverdue(daysBetween(due.due_on, today())) : recurringToday()}`}>
      <View style={s.dueTop}>
        {/* icon tile */}
        <View style={s.iconTile}>
          <Icon name="flow" size={20} color={MonoColors.textSecond} />
        </View>
        {/* name + sub */}
        <View style={s.dueMain}>
          <Text style={s.dueName}>{due.name}</Text>
          <Text style={s.dueSub}>{sub}</Text>
          {isOverdue && (
            <Text style={s.dueDate}>Jatuh tempo {formatShortDate(due.due_on)}</Text>
          )}
        </View>
        {/* amount + tag */}
        <View style={s.dueRight}>
          <Text style={s.dueAmount}>{shown(rp(due.amount), hidden)}</Text>
          <DueTag dueOn={due.due_on} />
        </View>
      </View>
      <View style={s.dueActions}>
        <Button label={recurringRecordNow()} onPress={onRecord} style={s.flex} />
        <Button label={recurringSkip()} variant="secondary" onPress={onSkip} style={s.flex} />
      </View>
    </View>
  );
}

// ─── Confirm sheet ────────────────────────────────────────────────────────────

function ConfirmSheet({ due, onClose }: { due: RecurringDueRow; onClose: () => void }) {
  const db = useDb();
  const qc = useQueryClient();
  const hidden = useHideAmounts(st => st.hidden);
  const [amount, setAmount] = useState(due.amount);
  const [busy, setBusy] = useState(false);

  const account = useQuery({
    queryKey: [...queryKeys.accounts, due.account_id],
    queryFn: () =>
      db.getFirstAsync<{ name: string; balance: number }>(
        'select name, balance from v_account_balance where id = $id',
        { $id: due.account_id },
      ),
  });

  const save = async () => {
    setBusy(true);
    try {
      const result = await confirmRecurring(
        db,
        {
          recurringId: due.recurring_id,
          dueOn: due.due_on,
          accountId: due.account_id,
          categoryId: due.category_id,
          amount,
          date: due.due_on,
          description: due.name,
        },
        nowIso(),
      );
      await qc.invalidateQueries();
      showToast(recurringSavedToast(account.data?.name ?? '', shown(rp(result.balanceAfter), hidden)));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    await skipRecurring(db, due.recurring_id, due.due_on, nowIso());
    await qc.invalidateQueries();
    onClose();
  };

  // nextDue: use day_of_month from the template, not the clamped due_on day
  const following = nextDue(
    { dayOfMonth: due.day_of_month, firstDueOn: due.due_on },
    addDays(due.due_on, 1),
  );

  const bal = account.data?.balance ?? 0;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <Pressable onPress={onClose} style={s.sheetClose} hitSlop={8}>
            <Icon name="close" color={MonoColors.text} />
          </Pressable>
          <Text style={s.sheetTitle}>{recurringConfirmTitle(due.name)}</Text>
          <Text style={s.sub}>{recurringConfirmDue(formatShortDate(due.due_on))}</Text>
          <AmountField label="Jumlah" value={amount} onChangeValue={setAmount} helperText={recurringUsualAmount()} />
          <InfoRow label="Kategori" value={due.category_name} />
          <InfoRow label="Bayar dari" value={account.data?.name ?? '…'} />
          <InfoRow label={recurringDate()} value={formatShortDate(due.due_on)} />
          <Text style={s.after}>{recurringAfter(account.data?.name ?? '', shown(rp(bal - amount), hidden))}</Text>
          <Button
            label={recurringRecord()}
            onPress={() => void save()}
            disabled={amount <= 0 || amount > bal}
            loading={busy}
          />
          <Button label={recurringSkip()} variant="secondary" onPress={() => void skip()} />
          <Text style={s.note}>
            {recurringSkipNote(following ? formatShortDate(following) : '—')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.sub}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  dueRows,
  templates,
  estimate,
  hidden,
}: {
  dueRows: RecurringDueRow[];
  templates: Awaited<ReturnType<typeof listRecurring>>;
  estimate: { amount: number; count: number; variesCount: number };
  hidden: boolean;
}) {
  const dueCount = dueRows.length;
  const dueTotal = dueRows.reduce((n, d) => n + d.amount, 0);

  // "Perlu dikonfirmasi" = all due rows (today + overdue)
  const dueStr = dueCount === 0
    ? 'Tidak ada'
    : `${dueCount} · ${shown(rp(dueTotal), hidden)}`;

  // Next future due
  const tom = addDays(today(), 1);
  const nextItem = templates
    .map(t => ({ ...t, due: nextDue({ dayOfMonth: t.day_of_month, firstDueOn: t.first_due_on, endOn: t.end_on }, tom) }))
    .filter(x => x.due)
    .sort((a, b) => a.due!.localeCompare(b.due!))
  [0];
  const nextStr = nextItem
    ? `${nextItem.name} · ${formatShortDate(nextItem.due!).replace(/ \d{4}$/, '')}`
    : '—';

  // varies note: name the first template with amount_varies
  const variesTemplate = templates.find(t => t.amount_varies === 1);
  const sub2 = variesTemplate
    ? `${estimate.count} pengeluaran tetap. Termasuk perkiraan untuk ${variesTemplate.name}.`
    : `${estimate.count} pengeluaran tetap`;

  return (
    <View style={s.summary}>
      <Text style={s.summaryLabel}>PER BULAN, PERKIRAAN</Text>
      <Text style={s.summaryHero}>{shown(rp(estimate.amount), hidden)}</Text>
      <Text style={s.sub}>{sub2}</Text>
      <View style={s.divider} />
      <StatRow label="Perlu dikonfirmasi" value={dueStr} />
      <StatRow label="Berikutnya" value={nextStr} />
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecurringScreen() {
  const db = useDb();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(st => st.hidden);
  const [selected, setSelected] = useState<RecurringDueRow | null>(null);
  const qc = useQueryClient();

  const dueQ = useQuery({ queryKey: [...queryKeys.recurring, 'due'], queryFn: () => listRecurringDue(db) });
  const templatesQ = useQuery({ queryKey: queryKeys.recurring, queryFn: () => listRecurring(db) });
  const estimateQ = useQuery({ queryKey: [...queryKeys.recurring, 'estimate'], queryFn: () => monthlyRecurringEstimate(db, today()) });

  const dueRows = dueQ.data ?? [];
  const templates = templatesQ.data ?? [];
  const estimate = estimateQ.data ?? { amount: 0, count: 0, variesCount: 0 };

  const skipRow = async (row: RecurringDueRow) => {
    await skipRecurring(db, row.recurring_id, row.due_on, nowIso());
    await qc.invalidateQueries();
  };

  // Next future items (after today) for "Segera" section
  const tom = addDays(today(), 1);
  const upcoming = templates
    .map(t => ({ ...t, due: nextDue({ dayOfMonth: t.day_of_month, firstDueOn: t.first_due_on, endOn: t.end_on }, tom) }))
    .filter(x => x.due)
    .sort((a, b) => a.due!.localeCompare(b.due!));

  const backRow = (
    <View style={[s.backRow, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={moreBackLabel()}
        hitSlop={4}
        style={({ pressed }) => [s.back, pressed && s.backPressed]}
      >
        <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
        <Text style={s.backText}>{moreBackText()}</Text>
      </Pressable>
    </View>
  );

  if (templatesQ.isSuccess && templates.length === 0) {
    return (
      <View style={s.screen}>
        {backRow}
        <HeaderRow title={recurringTitle()} withTopInset={false} />
        <View style={s.empty}>
          <Icon name="refresh" size={26} color={MonoColors.textDisabled} />
          <Text style={s.emptyBody}>{recurringEmpty()}</Text>
          <Button label={recurringAdd()} onPress={() => router.push('/recurring/edit' as never)} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      {backRow}
      <HeaderRow title={recurringTitle()} withTopInset={false} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={s.intro}>{recurringIntro()}</Text>

        <SummaryCard dueRows={dueRows} templates={templates} estimate={estimate} hidden={hidden} />

        {dueRows.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>{recurringNeedsConfirmation().toUpperCase()}</Text>
              <Text style={s.sectionCount}>{dueRows.length}</Text>
            </View>
            {dueRows.map(d => (
              <DueCard
                key={`${d.recurring_id}-${d.due_on}`}
                due={d}
                onRecord={() => setSelected(d)}
                onSkip={() => void skipRow(d)}
              />
            ))}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={s.sectionLabel}>{recurringComingUp().toUpperCase()}</Text>
            {upcoming.slice(0, 4).map(t => (
              <Pressable
                key={`${t.id}-${t.due}`}
                onPress={() => router.push(`/recurring/edit?id=${t.id}` as never)}
                style={s.upcomingRow}
              >
                <View>
                  <Text style={s.dueName}>{t.name}</Text>
                  <Text style={s.dueSub}>{formatShortDate(t.due!)}</Text>
                </View>
                <View style={s.upcomingRight}>
                  <Text style={s.statValue}>
                    {shown(t.amount_varies ? recurringAbout(rp(t.amount)) : rp(t.amount), hidden)}
                  </Text>
                  {t.amount_varies === 1 && <Text style={s.sub}>{recurringVaries()}</Text>}
                </View>
              </Pressable>
            ))}
          </>
        )}

        <Button label={recurringAdd()} onPress={() => router.push('/recurring/edit' as never)} />
        <Text style={s.note}>{recurringReminderNote()}</Text>
      </ScrollView>

      {selected && <ConfirmSheet due={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  backRow: { paddingHorizontal: 8, paddingBottom: 0 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  backPressed: { opacity: 0.7 },
  backText: { ...MonoText.bodyS, color: MonoColors.textSecond },

  content: { paddingHorizontal: 16, gap: 12 },
  intro: { ...MonoText.bodyS, color: MonoColors.textSecond, lineHeight: 18 },

  // Summary card
  summary: { backgroundColor: MonoColors.card, borderRadius: 20, padding: 16, gap: 6 },
  summaryLabel: { ...MonoText.label, color: MonoColors.textMeta, letterSpacing: 0.88 },
  summaryHero: { ...MonoText.figureM, color: MonoColors.text },
  divider: { height: 1, backgroundColor: '#272728', marginVertical: 6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  statLabel: { ...MonoText.bodyS, color: MonoColors.textSecond },
  statValue: { ...MonoText.bodyS, color: MonoColors.text, fontVariant: ['tabular-nums'] as never },

  // Section header
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionLabel: { ...MonoText.label, color: MonoColors.textMeta, letterSpacing: 0.88 },
  sectionCount: { ...MonoText.bodyS, color: MonoColors.textMeta, fontVariant: ['tabular-nums'] as never },

  // Due card — #151516 bg, 1.5px border, radius 16
  dueCard: { backgroundColor: '#151516', borderColor: '#737373', borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 10 },
  dueTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  iconTile: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B', alignItems: 'center', justifyContent: 'center' },
  dueMain: { flex: 1, gap: 2 },
  dueName: { fontFamily: 'IBMPlexSans_600SemiBold', fontSize: 14, lineHeight: 20, color: MonoColors.text },
  dueSub: { ...MonoText.bodyS, color: MonoColors.textMeta },
  dueDate: { ...MonoText.bodyS, color: MonoColors.textSecond },
  dueRight: { alignItems: 'flex-end', gap: 4 },
  dueAmount: { fontFamily: 'IBMPlexSans_600SemiBold', fontSize: 14, lineHeight: 20, color: MonoColors.text, fontVariant: ['tabular-nums'] as never },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  dueActions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, height: 44 },

  // Upcoming
  upcomingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: MonoColors.border, minHeight: 56 },
  upcomingRight: { alignItems: 'flex-end', gap: 2 },

  // Empty state
  empty: { flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  // Confirm sheet
  scrim: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: { backgroundColor: MonoColors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  sheetClose: { position: 'absolute', right: 12, top: 12, padding: 12 },
  sheetTitle: { ...MonoText.titleM, color: MonoColors.text, paddingRight: 36 },
  infoRow: { borderBottomWidth: 1, borderBottomColor: MonoColors.border, paddingVertical: 8, gap: 2 },
  infoValue: { ...MonoText.body, color: MonoColors.text },
  after: { ...MonoText.bodyStrong, color: MonoColors.text },

  // Shared
  sub: { ...MonoText.bodyS, color: MonoColors.textMeta },
  note: { ...MonoText.bodyS, color: MonoColors.textMeta, textAlign: 'center' },
});
