// docs/DESIGN.md's Account cards addendum supersedes section 11's "monochrome, no bank
// logos" rule for this component only: cards use each bank's own brand colour and logo
// (see bankCards.ts and the addendum note in docs/DESIGN.md). `accent`/`positive`/
// `negative` stay reserved for amount signs everywhere else (CLAUDE.md rule 5) — the
// card surface is the one deliberate exception, on the same footing as the real logo
// mark the rule already carves out. The nominal on a card always uses the card's own
// `fg`, never green or red: no `kind` is ever passed to <Amount> here.
import { Logo } from 'idn-finlogos/react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { useHideAmounts } from '@/components/hide-amounts-store';
import type { AccountType } from '@/data/repo/accounts';
import { rp, shown } from '@/core/money';
import { accountTypeTag, bankCardAccessibilityLabel, valasCurrencyCountTag } from '@/i18n/id';
import { radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { BANK_CARDS, NEUTRAL_CARDS, type BankCardStyle } from './bankCards';
import { BRAND_LOGOS, CARD_ASSETS, NEUTRAL_GLYPHS } from './cardAssets';

export interface BankCardProps {
  name: string;
  type: AccountType;
  icon: string | null; // accounts.icon; null or an unrecognised slug falls back to a neutral card
  balance: number; // whole rupiah; for a Valas account, the total rupiah value
  currencyCount?: number; // Valas only: drives the "N MATA UANG" tag instead of "VALAS"
  subline?: string; // Valas only, e.g. "US$250,00 · S$180,00"
  variant?: 'carousel' | 'list'; // carousel: fixed 312×184. list: full width, 358:184
  onPress: () => void;
  testID?: string;
}

// Guessed: logo box. idn-finlogos' bank wordmarks share one ~80×25 viewBox grid, so a
// 96-wide box at the spec's 28–30 tall range never clips or distorts any of them.
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = 96;
const GLYPH_SIZE = 28;

function resolveSlug(icon: string | null, type: AccountType): string {
  if (icon && icon in BANK_CARDS) return icon;
  if (type === 'cash') return 'cash';
  if (type === 'forex') return 'valas';
  return 'default';
}

export function BankCard({ name, type, icon, balance, currencyCount, subline, variant = 'list', onPress, testID }: BankCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const slug = resolveSlug(icon, type);
  const brand: BankCardStyle | undefined = BANK_CARDS[slug];
  const neutral = NEUTRAL_CARDS[slug as keyof typeof NEUTRAL_CARDS];
  const fg = (brand ?? neutral).fg;
  const image = CARD_ASSETS[slug];

  const tag = type === 'forex' && currencyCount != null ? valasCurrencyCountTag(currencyCount) : accountTypeTag(type);
  const balanceText = shown(rp(balance), hidden);
  const accessibilityLabel = bankCardAccessibilityLabel(name, type, balanceText);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={variant === 'carousel' ? styles.carousel : styles.list}
    >
      <View style={styles.card}>
        <Image testID={testID ? `${testID}-bg` : undefined} source={image} resizeMode="cover" style={StyleSheet.absoluteFill} />
        <View style={styles.content}>
          <View style={styles.topRow}>
            {brand?.wordmark ? (
              <Text style={[styles.wordmark, { color: fg }]}>{slug}</Text>
            ) : brand ? (
              <Logo svg={BRAND_LOGOS[slug]} width={LOGO_WIDTH} height={LOGO_HEIGHT} preserveAspectRatio="xMinYMid meet" />
            ) : (
              <Logo svg={NEUTRAL_GLYPHS[slug]} width={GLYPH_SIZE} height={GLYPH_SIZE} color={fg} />
            )}
            <View style={styles.tagWrap}>
              <View style={[styles.tagBorder, { borderColor: fg }]} />
              <Text style={[styles.tagText, { color: fg }]}>{tag}</Text>
            </View>
          </View>
          <View>
            <Text style={[styles.name, { color: fg }]} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.balanceRow}>
              {type === 'forex' && <Text style={[styles.approx, { color: fg }]}>{'≈ '}</Text>}
              <Amount value={balance} variant="figureM" style={{ color: fg }} />
            </View>
            {!!subline && (
              <Text style={[styles.subline, { color: fg }]} numberOfLines={1}>
                {subline}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carousel: { width: 312, height: 184 },
  list: { width: '100%', aspectRatio: 358 / 184 },
  card: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  content: { flex: 1, padding: 16, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tagWrap: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagBorder: { ...StyleSheet.absoluteFill, borderWidth: 1, borderRadius: 12, opacity: 0.4 },
  tagText: { ...MonoText.label, textTransform: 'uppercase' },
  wordmark: { ...MonoText.titleM, textTransform: 'lowercase' },
  name: { ...MonoText.bodyStrong, marginBottom: 2 },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline' },
  approx: { ...MonoText.figureM },
  subline: { ...MonoText.bodyS, opacity: 0.8, marginTop: 2 },
});
