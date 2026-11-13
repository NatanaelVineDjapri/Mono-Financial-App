// The round country flag of a currency, or its code in a disc when the currency has no flag of
// its own (the monetary unions listed in currencyFlags.ts).
//
// Flags keep their own colours. This is a second exception to "no other hue" (CLAUDE.md rule 5
// and the colour rules in docs/DESIGN.md), the first being the surface of an account card: a
// flag recoloured to charcoal and gold is no longer the flag, and the same three letters mean
// nothing to someone who does not already know the code. The 1 px ring is what keeps a light
// flag (JP, MY) reading as a disc on the dark surface, and the code fallback keeps the same
// footprint so a row never jumps between a flagged and an unflagged pocket.
import { StyleSheet, Text, View } from 'react-native';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { CURRENCY_FLAGS } from './currencyFlags';

export function CurrencyFlag({ code, size = 40 }: { code: string; size?: number }) {
  const Flag = CURRENCY_FLAGS[code];
  return (
    // The row already announces the currency by name; the disc is decoration, like the old one.
    <View
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`currency-flag-${code}`}
    >
      {Flag ? (
        <Flag width={size - 2} height={size - 2} />
      ) : (
        <Text style={[styles.code, { fontSize: Math.max(8, Math.round(size * 0.275)) }]} numberOfLines={1}>
          {code}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The 1 px border is inset by the borderWidth, so the flag itself is drawn at size - 2 and
  // still sits flush inside the ring.
  disc: { backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B', alignItems: 'center', justifyContent: 'center' },
  code: { ...MonoText.label, color: MonoColors.text },
});
