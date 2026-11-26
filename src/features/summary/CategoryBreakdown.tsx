// "Where it went": a donut of the biggest categories, then every category with its share and amount. A category whose
// records use sub-categories opens to show how it splits between them.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { IconRing } from '@/components/IconRing';
import { RingChart, type RingSegment } from '@/components/RingChart';
import { pct, rp, shown } from '@/core/money';
import type { SummaryCategory } from '@/domain/summary';
import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { othersCategoryLabel, summaryCategoryA11y, summaryExpense, summaryNoSpending, summaryNoSub, summaryWhereTitle } from '@/i18n';
import { CHART_CATEGORY_COLORS, MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const TOP = CHART_CATEGORY_COLORS.length - 1; // the last colour is the "Others" slice
const colorOf = (index: number) => CHART_CATEGORY_COLORS[Math.min(index, TOP)];

export function CategoryBreakdown({ categories, total }: { categories: SummaryCategory[]; total: number }) {
  const hidden = useHideAmounts(s => s.hidden);
  const [open, setOpen] = useState<number | null>(null);

  const segments: RingSegment[] = categories.slice(0, TOP).map((c, i) => ({
    id: c.id,
    label: c.name,
    valueIdr: c.amount,
    color: colorOf(i),
    badge: <CategoryIcon iconKey={c.icon} size={18} color={MonoColors.text} />,
  }));
  const rest = categories.slice(TOP).reduce((sum, c) => sum + c.amount, 0);
  if (rest > 0) segments.push({ id: -1, label: othersCategoryLabel(), valueIdr: rest, color: colorOf(TOP) });
  const spoken = categories.map(c => summaryCategoryA11y(c.name, pct(c.shareBp), shown(rp(c.amount), hidden))).join('; ');

  return (
    <Card style={styles.card} testID="summary-categories">
      <Text style={styles.title} accessibilityRole="header">{summaryWhereTitle()}</Text>
      {categories.length === 0 ? (
        <Text style={styles.empty}>{summaryNoSpending()}</Text>
      ) : (
        <>
          <View style={styles.ring}>
            <RingChart
              segments={segments}
              size={240}
              strokeWidth={38}
              centerLabel={summaryExpense()}
              centerValue={shown(rp(total), hidden)}
              selectedId={open ?? undefined}
              onSegmentPress={id => id !== -1 && setOpen(id)}
              accessibilityLabel={spoken}
              testID="summary-ring"
            />
          </View>
          {categories.map((c, i) => {
            const expandable = c.subs.length > 0;
            const isOpen = expandable && open === c.id;
            return (
              <View key={c.id} style={i > 0 && styles.divider}>
                <Pressable
                  onPress={expandable ? () => setOpen(isOpen ? null : c.id) : undefined}
                  disabled={!expandable}
                  accessibilityRole={expandable ? 'button' : undefined}
                  accessibilityState={expandable ? { expanded: isOpen } : undefined}
                  accessibilityLabel={summaryCategoryA11y(c.name, pct(c.shareBp), shown(rp(c.amount), hidden))}
                  accessible
                  android_ripple={undefined}
                  style={styles.row}
                  testID={`summary-category-${c.id}`}
                >
                  <IconRing valueBp={c.shareBp} color={colorOf(i)}>
                    <CategoryIcon iconKey={c.icon} size={20} color={MonoColors.text} />
                  </IconRing>
                  <View style={styles.main}>
                    <Text style={styles.name}>{c.name}</Text>
                    <Text style={styles.percent}>{pct(c.shareBp)}</Text>
                  </View>
                  <Amount value={c.amount} variant="figureS" style={styles.amount} />
                  {expandable && <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={16} color={MonoColors.textSecond} />}
                </Pressable>
                {isOpen && (
                  <View style={styles.subs} testID={`summary-subs-${c.id}`}>
                    {c.subs.map(sub => (
                      <View key={sub.id ?? 'none'} style={styles.subRow} accessible accessibilityLabel={`${sub.name ?? summaryNoSub()}, ${shown(rp(sub.amount), hidden)}`}>
                        <View style={styles.branch} />
                        <Text style={[styles.subName, sub.id === null && styles.subNone]}>{sub.name ?? summaryNoSub()}</Text>
                        <Amount value={sub.amount} variant="figureS" style={styles.amount} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
  ring: { alignItems: 'center', paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 48 },
  main: { flex: 1, minWidth: 96, gap: 2 },
  name: { ...MonoText.body, color: MonoColors.text },
  percent: { ...MonoText.caption, color: MonoColors.textMeta },
  amount: { marginLeft: 'auto' },
  subs: { paddingLeft: 22, paddingBottom: 8 },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, minHeight: 36 },
  // the branch from the category above to this sub-category
  branch: { width: 14, height: 18, marginTop: -14, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderBottomLeftRadius: 8, borderColor: MonoColors.textDisabled },
  subName: { ...MonoText.bodyS, color: MonoColors.text, flex: 1, minWidth: 96 },
  subNone: { color: MonoColors.textSecond },
});
