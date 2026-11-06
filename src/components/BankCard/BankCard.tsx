// docs/DESIGN.md's Account cards addendum supersedes section 11's "monochrome, no bank
// logos" rule for this component only: cards use each bank's own brand colour and logo
// (see bankCards.ts and the addendum note in docs/DESIGN.md). `accent`/`positive`/
// `negative` stay reserved for amount signs everywhere else (CLAUDE.md rule 5) — the
// card surface is the one deliberate exception, on the same footing as the real logo
// mark the rule already carves out. The nominal on a card always uses the card's own
// `fg`, never green or red: no `kind` is ever passed to <Amount> here.
import { Logo } from "idn-finlogos/react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { Amount } from "@/components/Amount";
import { useHideAmounts } from "@/components/hide-amounts-store";
import type { AccountType } from "@/data/repo/accounts";
import { rp, shown } from "@/core/money";
import { accountTypeTag, bankCardAccessibilityLabel, currencyCountTag } from "@/i18n/id";
import { radius } from "@/theme/tokens";
import { MonoText } from "@/theme/typography";

import { BANK_CARDS, NEUTRAL_CARDS, type BankCardStyle } from "./bankCards";
import {
  BRAND_LOGOS,
  CARD_ASSETS,
  NEUTRAL_GLYPHS,
  SVG_BACKGROUNDS,
} from "./cardAssets";

export interface BankCardProps {
  name: string;
  type: AccountType;
  icon: string | null; // accounts.icon; null or an unrecognised slug falls back to a neutral card
  balance: number; // whole rupiah; for a Valas account, the total rupiah value
  subline?: string; // Valas only, e.g. "US$250,00 · S$180,00"
  // forex only: pocket count, shown as the "N CURRENCIES" tag (DESIGN.md "Accounts with a
  // Valas account": "two overlapping currency coins, '2 CURRENCIES' tag"). Omitted (the
  // default everywhere except the Accounts card stack's open Valas card) means no tag.
  currencyCount?: number;
  // carousel: fixed 312×184. list: full width, 358:184 (the "open" card in the Accounts
  // card stack — CLAUDE.md/Fase 4.2c: "don't change the full look"). strip: full width,
  // 68 tall (the card stack's own *closed* card — Fase 4.2c's "potongan").
  variant?: "carousel" | "list" | "strip";
  // Overrides the default "<name>, <type>, balance <amount>" label — the Accounts card
  // stack uses its own "advance"/"open account" wording instead (Fase 4.2c).
  accessibilityLabel?: string;
  onPress: () => void;
  testID?: string;
}

// Guessed: logo box. idn-finlogos' bank wordmarks share one ~80×25 viewBox grid, so a
// 96-wide box at the spec's 28–30 tall range never clips or distorts any of them.
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = 96;
const GLYPH_SIZE = 28;
const STRIP_LOGO_HEIGHT = 20;
const STRIP_LOGO_WIDTH = 68;
const STRIP_GLYPH_SIZE = 20;
// The art (CARD_ASSETS/SVG_BACKGROUNDS) is drawn at a fixed 358:184 ratio regardless of
// the card's own current width — this is what lets the strip variant show the art's own
// top edge, cropped, rather than a squished whole image (Fase 4.2c step 1).
const ART_ASPECT = 358 / 184;
const STRIP_HEIGHT = 68;

function resolveSlug(icon: string | null, type: AccountType): string {
  if (icon && icon in BANK_CARDS) return icon;
  if (type === "cash") return "cash";
  if (type === "forex") return "valas";
  return "default";
}

export function BankCard({
  name,
  type,
  icon,
  balance,
  subline,
  currencyCount,
  variant = "list",
  accessibilityLabel,
  onPress,
  testID,
}: BankCardProps) {
  const hidden = useHideAmounts((s) => s.hidden);
  const slug = resolveSlug(icon, type);
  const brand: BankCardStyle | undefined = BANK_CARDS[slug];
  const neutral = NEUTRAL_CARDS[slug as keyof typeof NEUTRAL_CARDS];
  const fg = (brand ?? neutral).fg;
  const svgBackground = SVG_BACKGROUNDS[slug]; // overrides CARD_ASSETS when a PNG came out broken, see cardAssets.ts
  const image = CARD_ASSETS[slug];
  const isStrip = variant === "strip";

  // The Valas card's own flag-circle row already said "this is multi-currency" on its
  // own, so a plain forex card never shows a tag — but the Accounts card stack's own
  // *open* Valas card wants the "N CURRENCIES" pill back (DESIGN.md "Accounts with a
  // Valas account"), so this only fires when the caller passes currencyCount.
  const tag =
    type === "forex"
      ? currencyCount != null
        ? currencyCountTag(currencyCount)
        : null
      : accountTypeTag(type);
  const balanceText = shown(rp(balance), hidden);
  const defaultLabel = bankCardAccessibilityLabel(name, type, balanceText);

  // Fills whichever parent it's rendered into: `card` (list/carousel, already sized to
  // the art's own 358:184 ratio) or `artWrapper` (strip — see that style's own comment).
  const art = svgBackground ? (
    <SvgXml
      testID={testID ? `${testID}-bg` : undefined}
      xml={svgBackground}
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
    />
  ) : (
    <Image
      testID={testID ? `${testID}-bg` : undefined}
      source={image}
      resizeMode="cover"
      style={styles.background}
    />
  );

  const logo = brand?.wordmark ? (
    <Text
      style={[
        isStrip ? styles.stripWordmark : styles.wordmark,
        { color: fg },
      ]}
    >
      {slug}
    </Text>
  ) : brand ? (
    <Logo
      svg={BRAND_LOGOS[slug]}
      width={isStrip ? STRIP_LOGO_WIDTH : LOGO_WIDTH}
      height={isStrip ? STRIP_LOGO_HEIGHT : LOGO_HEIGHT}
      preserveAspectRatio="xMinYMid meet"
    />
  ) : (
    <Logo
      svg={NEUTRAL_GLYPHS[slug]}
      width={isStrip ? STRIP_GLYPH_SIZE : GLYPH_SIZE}
      height={isStrip ? STRIP_GLYPH_SIZE : GLYPH_SIZE}
      color={fg}
    />
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? defaultLabel}
      testID={testID}
      style={
        variant === "carousel"
          ? styles.carousel
          : isStrip
            ? styles.strip
            : styles.list
      }
    >
      <View style={isStrip ? styles.stripCard : styles.card}>
        {isStrip ? <View style={styles.artWrapper}>{art}</View> : art}
        {isStrip ? (
          <View style={styles.stripContent}>
            <View style={styles.stripLeft}>
              {logo}
              <Text
                style={[styles.stripName, { color: fg }]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </View>
            <View style={styles.balanceRow}>
              {type === "forex" && (
                <Text style={[styles.stripApprox, { color: fg }]}>
                  {"≈ "}
                </Text>
              )}
              <Amount
                value={balance}
                variant="figureS"
                style={{ ...styles.stripBalance, color: fg }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.topRow}>
              {logo}
              {/* Every other card's tag sits here, top-right of the logo — but Valas's
                  own background art draws its flag row across exactly this area (see
                  assets/bank-cards/svg-backgrounds/valas.svg), so its tag moves down to
                  sit above the name instead, clear of the flags. */}
              {tag && type !== "forex" && (
                <View style={styles.tagWrap}>
                  <View style={[styles.tagBorder, { borderColor: fg }]} />
                  <Text style={[styles.tagText, { color: fg }]}>{tag}</Text>
                </View>
              )}
            </View>
            <View style={styles.accountDetails}>
              {tag && type === "forex" && (
                <View style={styles.forexTagRow}>
                  <View style={styles.tagWrap}>
                    <View style={[styles.tagBorder, { borderColor: fg }]} />
                    <Text style={[styles.tagText, { color: fg }]}>{tag}</Text>
                  </View>
                </View>
              )}
              <Text style={[styles.name, { color: fg }]} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.balanceRow}>
                {type === "forex" && (
                  <Text style={[styles.approx, { color: fg }]}>{"≈ "}</Text>
                )}
                <Amount
                  value={balance}
                  variant="figureM"
                  style={{ color: fg }}
                />
              </View>
              {!!subline && (
                <Text
                  style={[styles.subline, { color: fg }]}
                  numberOfLines={1}
                >
                  {subline}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carousel: { width: 312, height: 184 },
  list: { width: "100%", aspectRatio: 358 / 184 },
  card: { flex: 1, borderRadius: radius.lg, overflow: "hidden" },
  // Explicit 100%/100% alongside StyleSheet.absoluteFill: on this RN/Fabric version, an
  // Image positioned only via absoluteFill's inset edges (no explicit size) sometimes
  // falls back to its asset's own registered intrinsic size — here, the exact 358×184
  // logical dp the @3x PNG's physical pixels resolve to — instead of stretching to this
  // (aspectRatio-sized, not literally 358×184) parent. Confirmed via a real device's
  // measured layout, not just Jest: the gap only shows up against the parent's actual
  // resolved width, which a fixed-width Jest render can't reproduce.
  background: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  content: { flex: 1, padding: 16, justifyContent: "space-between" },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  tagWrap: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderRadius: 12,
    opacity: 0.4,
  },
  tagText: { ...MonoText.label, textTransform: "uppercase" },
  wordmark: { ...MonoText.titleM, textTransform: "lowercase" },
  name: { ...MonoText.bodyStrong, marginBottom: 2 },
  forexTagRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 },
  balanceRow: { flexDirection: "row", alignItems: "baseline" },
  approx: { ...MonoText.figureM },
  subline: { ...MonoText.bodyS, opacity: 0.8, marginTop: 2 },
  accountDetails: {
    marginBottom: 5,
  },

  // Fase 4.2c "strip" variant (the Accounts card stack's closed card): a fixed-height
  // (growing with text scale, never shrinking below it) window onto the SAME full-height
  // art the open card uses, top-aligned and cropped — not a squished whole image.
  strip: { width: "100%", minHeight: STRIP_HEIGHT },
  stripCard: {
    flex: 1,
    minHeight: STRIP_HEIGHT,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  // position:absolute + aspectRatio: the art renders at its own true 358:184 height
  // (same as the open card, full width) regardless of the strip's own shorter height;
  // `stripCard`'s `overflow: hidden` does the actual cropping.
  artWrapper: { position: "absolute", top: 0, left: 0, right: 0, aspectRatio: ART_ASPECT },
  stripContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stripLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  stripName: { ...MonoText.bodyStrong, flexShrink: 1 },
  stripWordmark: { ...MonoText.body, textTransform: "lowercase" },
  stripApprox: { ...MonoText.figureS },
  // 16/20, 600 (Fase 4.2c step 1) — no matching shared token, so this overrides figureS's
  // size/line-height/weight locally while keeping its tabular-nums (CLAUDE.md: don't add
  // a one-off token to the shared type scale for a single component's own need).
  stripBalance: {
    fontFamily: MonoText.titleM.fontFamily,
    fontSize: 16,
    lineHeight: 20,
  },
});
