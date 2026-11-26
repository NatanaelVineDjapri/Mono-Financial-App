// The pieces of the Analysis screen (boards Analyze and Analyze-States). They only draw what they are given: the
// score, the sentences and the links all arrive ready-made from data.ts and copy.ts. Silver (the accent) is for the
// score and its bars; red appears only inside the existing striped "over" bar. No colour carries meaning alone:
// the band, the points and the change are always written out.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import type { EligibilityCheck, HealthBand, SavingsDrop } from '@/domain/health';
import { monthName, monthShortLabel } from '@/core/date';
import { pct } from '@/core/money';
import * as t from '@/i18n';

import type { ImprovementCard, LinkTarget, PartRow, WatchCard } from './copy';
import { ScoreRing } from './ScoreRing';
import type { TrendPoint } from './data';

export type Go = (target: LinkTarget) => void;

// ---------------------------------------------------------------- the score card

export function BandBadge({ band }: { band: HealthBand }) {
  const strong = band === 'healthy';
  return (
    <View style={[styles.badge, strong ? styles.badgeGold : styles.badgeNeutral]} testID="analysis-band">
      <Text style={[styles.badgeText, strong ? styles.badgeTextGold : styles.badgeTextNeutral]}>{t.analysisBand(band)}</Text>
    </View>
  );
}

export function ScoreCard({ score, band, delta, summary, countedNote, onHow }: {
  score: number;
  band: HealthBand;
  delta: { text: string; sign: -1 | 0 | 1 } | null;
  summary: string;
  countedNote: string | null;
  onHow: () => void;
}) {
  return (
    <Card style={styles.scoreCard} testID="analysis-score-card">
      <View style={styles.scoreTop}>
        <ScoreRing score={score} outOfLabel={t.analysisOutOf()} accessibilityLabel={t.analysisScoreA11y(score, t.analysisBand(band))} testID="analysis-ring" />
        <View style={styles.scoreSide}>
          <BandBadge band={band} />
          {delta && (
            <View style={styles.deltaRow} testID="analysis-delta">
              {delta.sign !== 0 && <Icon name={delta.sign > 0 ? 'arrow-up' : 'arrow-down'} size={16} color={delta.sign > 0 ? MonoColors.positive : MonoColors.textSecond} />}
              <Text style={[styles.delta, delta.sign > 0 && { color: MonoColors.positive }]}>{delta.text}</Text>
            </View>
          )}
          <Text style={styles.scoreCaption}>{t.analysisScoreTitle()}</Text>
        </View>
      </View>
      <Text style={styles.summary} testID="analysis-summary">{summary}</Text>
      {countedNote && <Text style={styles.countedNote} testID="analysis-counted-note">{countedNote}</Text>}
      <View style={styles.note}>
        <Icon name="lock" size={18} color={MonoColors.text} />
        <Text style={styles.noteText}>
          {t.analysisNote()}{' '}
          <Text style={styles.noteLink} onPress={onHow} accessibilityRole="link" accessibilityLabel={t.analysisHowLink()} testID="analysis-how-link">{t.analysisHowLink()}</Text>
        </Text>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------- what the score is made of

const PART_ICON: Record<PartRow['id'], IconName> = {
  savings: 'wallet',
  budget: 'savings',
  emergency: 'shield',
  fixed: 'refresh',
  wealth: 'trend',
};

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

// The one deduction (savingsDrop in src/domain/health), as the last line under the parts: it explains why the parts
// add up to more than the score. Calm like the rest of the card: written out and signed, never red.
function DropRow({ drop }: { drop: SavingsDrop }) {
  const from = pct(drop.fromBp);
  const to = pct(drop.toBp);
  return (
    <View style={[styles.partRow, styles.rowDivider, styles.dropRow]} accessible accessibilityLabel={t.analysisDropA11y(drop.points, from, to)} testID="analysis-drop">
      <View style={styles.partIcon}><Icon name="arrow-down" size={20} color={MonoColors.text} /></View>
      <View style={styles.partBody}>
        <View style={styles.partTop}>
          <View style={styles.partNameRow}>
            <Text style={styles.partName}>{t.analysisDropTitle()}</Text>
          </View>
          <Text style={styles.partPoints}>{t.analysisDropPoints(drop.points)}</Text>
        </View>
        <Text style={styles.partDetail}>{t.analysisDropDetail(from, to)}</Text>
      </View>
    </View>
  );
}

export function PartsCard({ rows, drop, onGo }: { rows: PartRow[]; drop: SavingsDrop | null; onGo: Go }) {
  return (
    <Card style={styles.listCard} testID="analysis-parts">
      {rows.map((row, i) => (
        <View key={row.id} style={[styles.partRow, i > 0 && styles.rowDivider]} accessible accessibilityLabel={row.a11y} testID={`analysis-part-${row.id}`}>
          <View style={styles.partIcon}><Icon name={PART_ICON[row.id]} size={20} color={MonoColors.textSecond} /></View>
          <View style={styles.partBody}>
            <View style={styles.partTop}>
              <View style={styles.partNameRow}>
                <Text style={styles.partName}>{row.name}</Text>
                {row.lowest && <View style={styles.lowestTag}><Text style={styles.lowestText}>{t.analysisLowestTag()}</Text></View>}
              </View>
              {row.skipped ? (
                <Text style={styles.partSkipped}>{t.analysisSkippedTag()}</Text>
              ) : (
                <Text style={styles.partPoints}>{row.points}<Text style={styles.partMax}>/{row.max}</Text></Text>
              )}
            </View>
            {row.skipped ? (
              row.skippedLink && (row.skippedLink.target ? (
                <Pressable onPress={() => onGo(row.skippedLink!.target!)} accessibilityRole="link" accessibilityLabel={row.skippedLink.label} style={styles.skipLink} testID={`analysis-part-${row.id}-link`}>
                  <Text style={styles.skipLinkText}>{row.skippedLink.label}</Text>
                  <Icon name="chevron-right" size={16} color={MonoColors.text} />
                </Pressable>
              ) : (
                <Text style={styles.partDetail}>{row.skippedLink.label}</Text>
              ))
            ) : (
              <>
                <Text style={styles.partDetail}>{row.detail}</Text>
                <View style={styles.track} importantForAccessibility="no-hide-descendants">
                  <View style={[styles.trackFill, { width: `${row.max > 0 ? Math.round((row.points * 100) / row.max) : 0}%` }]} />
                </View>
              </>
            )}
          </View>
        </View>
      ))}
      {drop && <DropRow drop={drop} />}
    </Card>
  );
}

// ---------------------------------------------------------------- what could raise it, heads up, going well

export function ImprovementList({ cards, onGo }: { cards: ImprovementCard[]; onGo: Go }) {
  return (
    <View style={styles.stack} testID="analysis-improvements">
      {cards.map(card => (
        <Card key={card.key} style={styles.improveCard} testID={`analysis-improve-${card.kind}`}>
          <View style={styles.improveTop}>
            <Text style={styles.improveTitle}>{card.title}</Text>
            <View style={styles.pointsChip}><Text style={[styles.pointsChipText, card.kind === 'fixed' && { color: MonoColors.textSecond }]}>{card.chip}</Text></View>
          </View>
          <Text style={styles.improveBody}>{card.body}</Text>
          {card.bar && (
            <View style={{ marginTop: 14 }}>
              <ProgressBar valueBp={card.bar.fillBp} label={card.title} overAmount={card.bar.overAmount} accessibilityLabel={card.foot ?? card.title} />
            </View>
          )}
          {card.foot && <Text style={styles.improveFoot}>{card.foot}</Text>}
          <Pressable onPress={() => onGo(card.link.target)} accessibilityRole="link" accessibilityLabel={card.link.label} android_ripple={undefined} style={styles.cardLink} testID={`analysis-improve-${card.kind}-link`}>
            <Text style={styles.cardLinkText}>{card.link.label}</Text>
            <Icon name="chevron-right" size={16} color={MonoColors.text} />
          </Pressable>
        </Card>
      ))}
    </View>
  );
}

export function WatchCardView({ card, onGo }: { card: WatchCard; onGo: Go }) {
  return (
    <Card style={styles.improveCard} testID="analysis-watch">
      <View style={styles.improveTop}>
        <Text style={styles.improveTitle}>{card.title}</Text>
        <View style={styles.watchTag}><Text style={styles.watchTagText}>{card.tag}</Text></View>
      </View>
      <Text style={styles.improveBody}>{card.body}</Text>
      <Pressable onPress={() => onGo(card.link.target)} accessibilityRole="link" accessibilityLabel={card.link.label} android_ripple={undefined} style={styles.cardLink} testID="analysis-watch-link">
        <Text style={styles.cardLinkText}>{card.link.label}</Text>
        <Icon name="chevron-right" size={16} color={MonoColors.text} />
      </Pressable>
    </Card>
  );
}

export function GoodList({ sentences }: { sentences: string[] }) {
  return (
    <Card style={styles.listCard} testID="analysis-good">
      {sentences.map((text, i) => (
        <View key={i} style={[styles.goodRow, i > 0 && styles.rowDivider]}>
          <Icon name="check" size={18} color={MonoColors.accent} />
          <Text style={styles.goodText}>{text}</Text>
        </View>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------- the 6-month trend: bars, then the exact values

export function TrendCard({ points, untilText }: { points: TrendPoint[]; untilText: string | null }) {
  const summary = points.map(p => `${monthName(p.period)} ${p.score ?? t.analysisTrendNone()}`).join(', ');
  return (
    <Card style={styles.trendCard} testID="analysis-trend">
      <View style={styles.bars} accessible accessibilityRole="image" accessibilityLabel={t.analysisTrendA11y(summary)}>
        {points.map(p => (
          <View key={p.period} style={styles.barCol}>
            <Text style={styles.barValue}>{p.score ?? '—'}</Text>
            <View style={styles.barTrack}>
              {p.score !== null && <View style={[styles.barFill, { height: `${Math.max(2, p.score)}%` }]} />}
            </View>
            <Text style={styles.barLabel}>{monthShortLabel(p.period).split(' ')[0]}{p.partial ? '*' : ''}</Text>
          </View>
        ))}
      </View>
      {untilText && <Text style={styles.trendUntil}>{untilText}</Text>}
      <View style={styles.table} testID="analysis-trend-table">
        {points.map((p, i) => (
          <View key={p.period} style={[styles.tableRow, i > 0 && styles.rowDivider]} testID={`analysis-trend-row-${p.period}`}>
            <Text style={styles.tableMonth}>{monthName(p.period)}{p.partial ? ' *' : ''}</Text>
            <Text style={styles.tableScore}>{p.score ?? '—'}</Text>
            <Text style={styles.tableBand}>{p.band ? t.analysisBand(p.band) : t.analysisTrendNone()}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------- the score is not ready yet (board Analyze-States)

function checkText(c: EligibilityCheck): { need: string; have: string } {
  switch (c.id) {
    case 'accounts':
      return { need: t.analysisNeedAccounts(c.need), have: t.analysisHaveAccounts(c.have) };
    case 'transactions':
      return { need: t.analysisNeedTransactions(c.need), have: t.analysisHaveTransactions(c.have, c.met) };
    case 'span':
      return { need: t.analysisNeedSpan(c.need), have: t.analysisHaveSpan(c.have, c.met) };
  }
}

export function NotReady({ checks, onAdd }: { checks: EligibilityCheck[]; onAdd: () => void }) {
  return (
    <View testID="analysis-not-ready">
      <Card style={styles.notReadyCard}>
        <ScoreRing score={null} outOfLabel="" centerLabel={t.analysisNotReadyRing()} accessibilityLabel={t.analysisNotReadyTitle()} testID="analysis-ring" />
        <Text style={styles.notReadyTitle}>{t.analysisNotReadyTitle()}</Text>
        <Text style={styles.notReadyBody}>{t.analysisNotReadyBody()}</Text>
      </Card>
      <SectionHeader title={t.analysisNeedTitle()} />
      <Card style={styles.listCard}>
        {checks.map((c, i) => {
          const text = checkText(c);
          return (
            <View key={c.id} style={[styles.checkRow, i > 0 && styles.rowDivider]} accessible accessibilityLabel={`${text.need}. ${text.have}. ${c.met ? '✓' : ''}`} testID={`analysis-check-${c.id}`}>
              <View style={[styles.checkBox, c.met && styles.checkBoxOn]}>
                {c.met && <Icon name="check" size={16} color={MonoColors.bg} />}
              </View>
              <View style={styles.checkText}>
                <Text style={styles.partName}>{text.need}</Text>
                <Text style={styles.partDetail}>{text.have}</Text>
              </View>
            </View>
          );
        })}
      </Card>
      <View style={{ marginTop: 16 }}>
        <Button label={t.analysisAddTransaction()} onPress={onAdd} testID="analysis-add-transaction" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreCard: { padding: 20 },
  scoreTop: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  scoreSide: { flex: 1, gap: 8, alignItems: 'flex-start' },
  badge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  badgeGold: { borderColor: MonoColors.accent },
  badgeNeutral: { borderColor: MonoColors.textSecond },
  badgeText: { ...MonoText.bodyStrong, fontSize: 12, lineHeight: 16 },
  badgeTextGold: { color: MonoColors.accent },
  badgeTextNeutral: { color: MonoColors.text },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  delta: { ...MonoText.bodyS, color: MonoColors.textSecond },
  scoreCaption: { ...MonoText.caption, color: MonoColors.textMeta },
  summary: { ...MonoText.bodyS, fontSize: 14, lineHeight: 21, color: MonoColors.text, marginTop: 16 },
  countedNote: { ...MonoText.caption, color: MonoColors.textSecond, marginTop: 8 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: 12, borderWidth: 1, borderColor: MonoColors.border, borderRadius: radius.lg, backgroundColor: MonoColors.bg },
  noteText: { ...MonoText.caption, color: MonoColors.textSecond, flex: 1, lineHeight: 17 },
  noteLink: { color: MonoColors.text, fontFamily: MonoText.bodyStrong.fontFamily, textDecorationLine: 'underline' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 28, paddingBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  sectionSub: { ...MonoText.caption, color: MonoColors.textMeta },
  stack: { gap: 12 },
  listCard: { padding: 0, overflow: 'hidden' },
  rowDivider: { borderTopWidth: 1, borderTopColor: MonoColors.border },

  partRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 18, paddingVertical: 18, minHeight: 76 },
  dropRow: { backgroundColor: MonoColors.raised },
  partIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.raised, alignItems: 'center', justifyContent: 'center' },
  partBody: { flex: 1, minWidth: 0 },
  partTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  partNameRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  partName: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.text },
  partPoints: { ...MonoText.figureRow, color: MonoColors.text },
  partMax: { color: MonoColors.textMeta },
  partSkipped: { ...MonoText.caption, color: MonoColors.textSecond },
  partDetail: { ...MonoText.caption, color: MonoColors.textMeta, marginTop: 6, lineHeight: 18 },
  lowestTag: { borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.raised, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  lowestText: { ...MonoText.caption, color: MonoColors.textSecond },
  track: { height: 6, borderRadius: 3, backgroundColor: MonoColors.border, marginTop: 14, overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: MonoColors.accent },
  skipLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  skipLinkText: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },

  improveCard: { padding: 18 },
  improveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  improveTitle: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.text, flex: 1 },
  improveBody: { ...MonoText.bodyS, color: MonoColors.textSecond, marginTop: 8, lineHeight: 20 },
  improveFoot: { ...MonoText.caption, color: MonoColors.textMeta, marginTop: 10 },
  pointsChip: { borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.raised, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pointsChipText: { ...MonoText.bodyStrong, fontSize: 12, lineHeight: 16, color: MonoColors.accent },
  watchTag: { borderWidth: 1, borderColor: MonoColors.textSecond, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  watchTagText: { ...MonoText.bodyStrong, fontSize: 12, lineHeight: 16, color: MonoColors.text },
  cardLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, marginTop: 14, borderTopWidth: 1, borderTopColor: MonoColors.border },
  cardLinkText: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },

  goodRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingVertical: 16, alignItems: 'flex-start' },
  goodText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1, lineHeight: 19 },

  trendCard: { padding: 16 },
  bars: { flexDirection: 'row', gap: 8, height: 150, alignItems: 'stretch' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { ...MonoText.caption, color: MonoColors.textSecond },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 6, backgroundColor: MonoColors.raised, overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6, backgroundColor: MonoColors.accent },
  barLabel: { ...MonoText.caption, color: MonoColors.textMeta },
  trendUntil: { ...MonoText.caption, color: MonoColors.textMeta, marginTop: 8 },
  table: { marginTop: 12 },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 34, gap: 8 },
  tableMonth: { ...MonoText.bodyS, color: MonoColors.text, flex: 1 },
  tableScore: { ...MonoText.figureRow, color: MonoColors.text, width: 40, textAlign: 'right' },
  tableBand: { ...MonoText.bodyS, color: MonoColors.textSecond, width: 110, textAlign: 'right' },

  notReadyCard: { alignItems: 'center', padding: 24, gap: 12 },
  notReadyTitle: { ...MonoText.titleM, color: MonoColors.text, textAlign: 'center' },
  notReadyBody: { ...MonoText.bodyS, color: MonoColors.textSecond, textAlign: 'center', lineHeight: 19 },
  checkRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 18, paddingVertical: 16, alignItems: 'center', minHeight: 68 },
  checkBox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: MonoColors.textSecond, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  checkText: { flex: 1 },
});
