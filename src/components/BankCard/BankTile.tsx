// A 32 square tile for an account, used in rows (Transaction detail's Account, From and To):
// the bank's own brand colour with its mark (a `plate` brand keeps its own colours, on white), or the neutral graphite with the generic glyph
// for cash, Valas and an account with no bank chosen. Same slug rules and same assets as
// BankCard; the account-card exception in CLAUDE.md rule 5 covers the brand colour here too.
// Decorative: the account name sits beside it, so it is hidden from screen readers.
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { AccountType } from '@/data/repo/accounts';

import { BANK_CARDS, NEUTRAL_CARDS } from './bankCards';
import { BrandLogo } from './BrandLogo';
import { BRAND_LOGOS, NEUTRAL_GLYPHS } from './cardAssets';

export const BANK_TILE_SIZE = 32;
const MARK_RATIO = 0.625; // the mark is this share of the tile (20 in a 32)

function resolveSlug(icon: string | null, type: AccountType): string {
  if (icon && icon in BANK_CARDS) return icon;
  if (type === 'cash') return 'cash';
  if (type === 'forex') return 'valas';
  return 'default';
}

export function BankTile({ icon, type, size = BANK_TILE_SIZE, testID }: { icon: string | null; type: AccountType; size?: number; testID?: string }) {
  const mark = Math.round(size * MARK_RATIO);
  const slug = resolveSlug(icon, type);
  const brand = BANK_CARDS[slug];
  const neutral = NEUTRAL_CARDS[slug as keyof typeof NEUTRAL_CARDS];
  const style = brand ?? neutral;

  const plate = brand?.plate === true;
  const glyph = plate ? (
    <BrandLogo slug={slug} width={size - 8} height={size - 8} />
  ) : brand ? (
    <SvgXml xml={BRAND_LOGOS[slug]} width={mark} height={mark} preserveAspectRatio="xMidYMid meet" />
  ) : (
    <SvgXml xml={NEUTRAL_GLYPHS[slug]} width={mark} height={mark} color={style.fg} />
  );

  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3125, backgroundColor: plate ? '#F5F5F5' : style.bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {glyph}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
