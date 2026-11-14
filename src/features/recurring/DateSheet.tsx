// Full-date picker sheet (YYYY-MM-DD), two-step flow:
//   Step 1: year + month grid — identical to GoalMonthSheet. Tap a month to advance.
//   Step 2: day grid for the chosen month. "Kembali" returns to step 1.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { cancelLabel, closeLabel, confirmLabel } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function initFrom(selected: string) {
  const now = new Date();
  const d = selected || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return {
    year: Number(d.slice(0, 4)),
    month: Number(d.slice(5, 7)),
    day: Number(d.slice(8, 10)) || 1,
  };
}

export interface DateSheetProps {
  visible: boolean;
  /** YYYY-MM-DD or '' */
  selected: string;
  title: string;
  subtitle?: string;
  /** Show "Hapus tanggal" in step 1 footer — for optional end-date field */
  optional?: boolean;
  onSelect: (date: string) => void;
  onClose: () => void;
}

export function DateSheet({ visible, selected, title, subtitle, optional, onSelect, onClose }: DateSheetProps) {
  const init = initFrom(selected);
  const [prevVisible, setPrevVisible] = useState(visible);
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [day, setDay] = useState(init.day);
  const [step, setStep] = useState<'month' | 'day'>('month');

  // Reset to month-step when reopened
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      const i = initFrom(selected);
      setYear(i.year);
      setMonth(i.month);
      setDay(i.day);
      setStep('month');
    }
  }

  const monthRows = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 3 }, (_, c) => r * 3 + c + 1),
  );

  const pickMonth = (m: number) => {
    setMonth(m);
    // Clamp day to new month's max
    setDay(d => Math.min(d, daysInMonth(year, m)));
    setStep('day');
  };

  const maxDay = daysInMonth(year, month);
  // Always 7 cells per row (spacer = 0) so every cell is the same flex width and height
  const dayRows: number[][] = [];
  for (let i = 1; i <= maxDay; i += 7) {
    const row = Array.from({ length: 7 }, (_, j) => (i + j <= maxDay ? i + j : 0));
    dayRows.push(row);
  }

  const confirm = () => onSelect(`${year}-${pad(month)}-${pad(day)}`);

  const stepSubtitle = step === 'day'
    ? `${MONTHS[month - 1]} ${year}`
    : (subtitle ?? '');

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()}>
      <View style={s.container}>
        <SheetHeader
          visible={visible}
          icon="calendar"
          title={title}
          subtitle={stepSubtitle}
          onClose={onClose}
        />

        {step === 'month' ? (
          <>
            {/* Year nav */}
            <View style={s.yearRow}>
              <HeaderButton icon="chevron-left" label="Tahun lalu" onPress={() => setYear(y => y - 1)} />
              <Text style={s.year}>{year}</Text>
              <HeaderButton icon="chevron-right" label="Tahun depan" onPress={() => setYear(y => y + 1)} />
            </View>

            {/* Month grid — tap to advance to day step */}
            <View style={s.grid}>
              {monthRows.map(row => (
                <View key={row[0]} style={s.row}>
                  {row.map(m => {
                    const sel = m === month;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => pickMonth(m)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: sel }}
                        style={[s.cell, sel && s.cellSelected]}
                      >
                        {sel && <Icon name="check" size={16} color={MonoColors.bg} />}
                        <Text style={sel ? s.cellTextSelected : s.cellText}>{MONTHS[m - 1]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Footer step 1 */}
            <View style={s.footer}>
              {optional && (
                <Button label="Hapus tanggal" variant="secondary" onPress={() => onSelect('')} style={s.flex} />
              )}
              <Button label={cancelLabel()} variant="secondary" onPress={onClose} style={s.flex} />
              <Button label={confirmLabel()} onPress={() => setStep('day')} style={s.flex} />
            </View>
          </>
        ) : (
          <>
            {/* Day grid */}
            <View style={s.grid}>
              {dayRows.map(row => (
                <View key={row[0]} style={s.row}>
                  {row.map((d, j) => {
                    if (d === 0) return <View key={`sp-${j}`} style={[s.dayCell, s.dayCellEmpty]} />;
                    const sel = d === day;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => setDay(d)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: sel }}
                        style={[s.dayCell, sel && s.cellSelected]}
                      >
                        <Text style={[s.dayCellText, sel && s.cellTextSelected]}>{d}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Footer step 2 */}
            <View style={s.footer}>
              <Button label="Kembali" variant="secondary" onPress={() => setStep('month')} style={s.flex} />
              <Button label={confirmLabel()} onPress={confirm} style={s.flex} />
            </View>
          </>
        )}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 4, gap: 2 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  year: { ...MonoText.titleM, color: MonoColors.text },
  grid: { gap: 6, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1, height: 48, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    borderRadius: radius.md, borderWidth: 1, borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
  },
  cellSelected: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  cellText: { ...MonoText.body, color: MonoColors.text },
  cellTextSelected: { ...MonoText.bodyStrong, color: MonoColors.bg },
  dayCell: {
    flex: 1, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
  },
  dayCellEmpty: { borderColor: 'transparent', backgroundColor: 'transparent' },
  dayCellText: { ...MonoText.bodyS, color: MonoColors.text, fontVariant: ['tabular-nums'] as never },
  footer: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: MonoColors.border, paddingTop: 12, marginTop: 4 },
  flex: { flex: 1 },
});
