// Realistic Indonesian Bank Physical Debit Card Component (PhysicalCard).
// Replicates physical cards issued by Indonesian banks (BCA, Mandiri, Jago, BNI, BRI, BSI, etc.)
// with metallic EMV microchip, Contactless RFID, official bank branding,.
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Amount } from '@/components/Amount';
import { useHideAmounts } from '@/components/hide-amounts-store';
import type { AccountType } from '@/data/repo/accounts';
import { rp, shown } from '@/core/money';
import { accountTypeTag, bankCardAccessibilityLabel } from '@/i18n';
import { MonoText } from '@/theme/typography';
import { BANK_CARDS } from '@/components/BankCard/bankCards';
import { BrandLogo, logoRatio } from '@/components/BankCard/BrandLogo';
import { BRAND_LOGOS, NEUTRAL_GLYPHS } from '@/components/BankCard/cardAssets';

import { EmvChip } from './EmvChip';
import { ContactlessGlyph } from './cardNetworks';
import {
  resolvePhysicalCardTheme,
  type PhysicalCardTheme,
} from './cardThemes';

export interface PhysicalCardProps {
  name: string;
  type: AccountType;
  icon?: string | null;
  balance: number;
  subline?: string;
  nativeOnly?: boolean;
  variant?: 'carousel' | 'list' | 'strip' | 'full';
  cardNumber?: string;
  cardholderName?: string;
  expiryDate?: string;
  liftContent?: boolean;
  accessibilityLabel?: string;
  onPress?: (event: GestureResponderEvent) => void;
  testID?: string;
}

// The sizes of the slots the app gives a card (the Overview carousel, the Accounts stack): the card is drawn to
// fit them, not the other way round. The artwork stretches to whatever size the card is.
const STRIP_HEIGHT = 68;
const LIST_HEIGHT = 184; // an open card in the Accounts stack: 358 wide, 184 tall
const CAROUSEL_WIDTH = 300;
const CAROUSEL_HEIGHT = 154;
const LIFT_EXTRA = 12; // the next card in the stack overlaps this much of the bottom

function PhysicalCardImpl({
  name,
  type,
  icon,
  balance,
  subline,
  nativeOnly = false,
  variant = 'list',
  cardNumber,
  cardholderName,
  expiryDate,
  liftContent = false,
  accessibilityLabel,
  onPress,
  testID,
}: PhysicalCardProps) {
  const hidden = useHideAmounts((s) => s.hidden);
  const theme: PhysicalCardTheme = resolvePhysicalCardTheme(icon, type);
  const fg = theme.fg;
  const isStrip = variant === 'strip';
  const isCarousel = variant === 'carousel';

  // The artwork is decorative: the app has no card number, so the default is a plain mask, never digits
  // made up from the balance. A caller that really has a number passes it in.
  const displayCardNumber = cardNumber ?? '•••• •••• •••• ••••';
  const displayHolder = cardholderName ?? name;

  const tag = type === 'forex' ? null : accountTypeTag(type);
  const balanceText = shown(rp(balance), hidden);
  const defaultLabel = bankCardAccessibilityLabel(name, type, balanceText);

  // Bank logo element
  const slug = icon ?? '';
  const brandSvg = BRAND_LOGOS[slug];
  const neutralSvg = NEUTRAL_GLYPHS[slug];
  // A plate brand keeps its own colours, on a white plate that hugs the logo's shape.
  const plate = BANK_CARDS[slug]?.plate === true;
  const plateHeight = isStrip ? 18 : 24;
  const plateWidth = plate ? Math.round(Math.min(isStrip ? 58 : 76, plateHeight * logoRatio(slug))) : 0;

  const logoNode = plate ? (
    <View style={styles.logoPlate} testID={`card-logo-plate-${slug}`}>
      <BrandLogo slug={slug} width={plateWidth} height={plateHeight} />
    </View>
  ) : brandSvg ? (
    <SvgXml
      xml={brandSvg}
      width={isStrip ? 58 : 76}
      height={isStrip ? 18 : 24}
      preserveAspectRatio="xMinYMid meet"
    />
  ) : neutralSvg ? (
    <SvgXml
      xml={neutralSvg}
      width={isStrip ? 18 : 24}
      height={isStrip ? 18 : 24}
      color={fg}
    />
  ) : (
    <Text style={[styles.bankNameText, { color: fg }]}>{theme.name}</Text>
  );

  // Balance element
  const balanceNode = nativeOnly ? (
    <Text
      style={[
        isStrip ? MonoText.bodyS : MonoText.figureCard,
        { color: fg },
      ]}
    >
      {subline}
    </Text>
  ) : (
    <View style={styles.balanceRow}>
      {type === 'forex' && (
        <Text style={[isStrip ? styles.stripApprox : styles.approx, { color: fg }]}>
          {'≈ '}
        </Text>
      )}
      <Amount
        value={balance}
        variant={isStrip ? 'figureS' : 'figureCard'}
        style={{ color: fg }}
      />
    </View>
  );

  // Compact Strip Variant
  if (isStrip) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? defaultLabel}
        testID={testID}
        style={[styles.stripContainer, { backgroundColor: theme.bg }]}
      >
        <View style={StyleSheet.absoluteFill}>
          <theme.Background />
        </View>

        <View style={styles.stripInner}>
          <View style={styles.stripLeft}>
            <View style={styles.stripLogoRow}>
              {logoNode}
              <Text
                style={[styles.stripName, { color: fg }]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </View>
            <View style={styles.stripChipRow}>
              {type !== 'cash' && type !== 'forex' && (
                <>
                  <EmvChip variant={theme.chipVariant} width={28} height={20} />
                  <Text style={[styles.stripNumber, { color: fg, opacity: 0.9 }]}>
                    {displayCardNumber.slice(-9)}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.stripRight}>
            {balanceNode}
          </View>
        </View>
      </Pressable>
    );
  }

  // Full / List / Carousel Variant
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? defaultLabel}
      testID={testID}
      style={[
        styles.cardContainer,
        isCarousel ? styles.carouselCard : styles.listCard,
        { backgroundColor: theme.bg },
      ]}
    >
      {/* Authentic Bank Vector Artwork */}
      <View style={StyleSheet.absoluteFill}>
        <theme.Background />
      </View>

      {/* Surface Gloss / Specular Sheen Layer */}
      <View style={styles.cardGlossBorder} />

      {/* Card Content Overlay */}
      <View style={[styles.cardContent, liftContent && styles.cardContentLifted]}>
        {/* Top Header: Bank Logo + Contactless Glyph + Tag */}
        <View style={styles.headerRow}>
          <View style={styles.logoAndTier}>
            {logoNode}
            {type !== 'forex' && (
              <Text numberOfLines={1} style={[styles.cardTierBadge, { color: fg, opacity: 0.8 }]}>
                {theme.cardTier}
              </Text>
            )}
          </View>

          <View style={styles.headerRight}>
            <ContactlessGlyph size={20} color={fg} />
            {tag && (
              <View style={[styles.tagPill, { borderColor: fg }]}>
                <Text style={[styles.tagText, { color: fg }]}>{tag}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Middle: the EMV chip with the number beside it (and a real expiry date, when there is one).
            Cash and Valas are not physical debit cards — no chip or number is shown for them. */}
        {type !== 'cash' && type !== 'forex' && (
          <View style={styles.chipNumberRow}>
            <EmvChip variant={theme.chipVariant} width={34} height={26} />
            <View style={styles.numberBlock}>
              <Text numberOfLines={1} style={[styles.cardNumberText, { color: fg }]}>
                {displayCardNumber}
              </Text>
              {expiryDate ? (
                <View style={styles.validRow}>
                  <Text style={[styles.validLabel, { color: fg, opacity: 0.7 }]}>VALID THRU</Text>
                  <Text style={[styles.validDate, { color: fg }]}>{expiryDate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Bottom Footer: Cardholder Name and Balance */}
        <View style={styles.footerRow}>
          <View style={styles.holderAndBalance}>
            <Text
              numberOfLines={1}
              style={[styles.cardholderText, { color: fg, opacity: 0.95 }]}
            >
              {displayHolder}
            </Text>
            <View style={styles.balanceContainer}>
              {balanceNode}
              {subline && !nativeOnly && (
                <Text
                  style={[MonoText.caption, { color: fg, opacity: 0.8 }]}
                >
                  {subline}
                </Text>
              )}
            </View>
          </View>

        </View>
      </View>
    </Pressable>
  );
}

// Memoized: a card is redrawn only when its own props change, not when a sibling or the list does.
export const PhysicalCard = React.memo(PhysicalCardImpl);

// ponytail: Static styles and responsive aspect ratio. Upgrade to animated 3D tilt gesture on high-end devices if requested.
const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  listCard: {
    width: '100%',
    height: LIST_HEIGHT,
  },
  carouselCard: {
    width: CAROUSEL_WIDTH,
    height: CAROUSEL_HEIGHT,
  },
  stripContainer: {
    width: '100%',
    height: STRIP_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  cardGlossBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  cardContentLifted: {
    paddingBottom: 12 + LIFT_EXTRA,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoAndTier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  logoPlate: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  bankNameText: {
    ...MonoText.titleM,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTierBadge: {
    flexShrink: 1,
    fontSize: 10,
    fontFamily: MonoText.mono.fontFamily,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    opacity: 0.8,
  },
  tagText: {
    fontSize: 9.5,
    fontFamily: MonoText.mono.fontFamily,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  cardNumberText: {
    fontFamily: MonoText.mono.fontFamily,
    fontSize: 14,
    letterSpacing: 1.8,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0.5, height: 1 },
    textShadowRadius: 1,
  },
  validRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  validLabel: {
    fontSize: 7.5,
    fontFamily: MonoText.mono.fontFamily,
    letterSpacing: 0.8,
  },
  validDate: {
    fontFamily: MonoText.mono.fontFamily,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  holderAndBalance: {
    flex: 1,
    marginRight: 12,
  },
  cardholderText: {
    fontFamily: MonoText.mono.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  balanceContainer: {
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  approx: {
    ...MonoText.figureM,
  },
  stripApprox: {
    ...MonoText.figureS,
  },
  stripInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: '100%',
  },
  // The left side gives way to the balance: a long account name is cut with an ellipsis, the amount on the right never is.
  stripLeft: {
    justifyContent: 'center',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 12,
  },
  stripLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  stripName: {
    ...MonoText.body,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  stripTierText: {
    fontSize: 9.5,
    fontFamily: MonoText.mono.fontFamily,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stripChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stripNumber: {
    fontFamily: MonoText.mono.fontFamily,
    fontSize: 11,
    letterSpacing: 1,
  },
  stripRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
});
