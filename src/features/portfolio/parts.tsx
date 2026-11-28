// Shared pieces of the portfolio screens: profit and loss in its sign's colour, and the name sheet.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { pct, rp, shown, shownPct } from '@/core/money';
import { closeLabel, portfolioCash, portfolioCashNone, portfolioErrorText, portfolioName, portfolioNamePlaceholder, portfolioSave } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// "+Rp1.000.000 (+20,00%)": green or red with its sign, never by colour alone.
export function ProfitText({ profit, bp, size = 'small' }: { profit: number; bp: number | null; size?: 'small' | 'large' }) {
  const hidden = useHideAmounts(s => s.hidden);
  const text = `${shown(rp(profit, true), hidden)}${bp == null ? '' : ` (${shownPct(pct(bp, true), hidden)})`}`;
  const color = profit > 0 ? MonoColors.positive : profit < 0 ? MonoColors.negative : MonoColors.textSecond;
  return <Text style={[size === 'large' ? styles.large : styles.small, { color }]}>{text}</Text>;
}

export interface NameSheetProps {
  visible: boolean;
  title: string;
  initialName: string;
  // the cash account row, only when making a portfolio
  cashName?: string | null;
  onPickCash?: () => void;
  onSave: (name: string) => Promise<string | null>; // the error code, or null when saved
  onClose: () => void;
}

export function NameSheet({ visible, title, initialName, cashName, onPickCash, onSave, onClose }: NameSheetProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(initialName);
      setError(null);
    }
  }
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="portfolio-name-sheet">
      <View style={styles.sheet}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <TextInput
          value={name}
          onChangeText={text => {
            setName(text);
            setError(null);
          }}
          placeholder={portfolioNamePlaceholder()}
          placeholderTextColor={MonoColors.textDisabled}
          selectionColor={MonoColors.text}
          accessibilityLabel={portfolioName()}
          maxLength={30}
          style={styles.input}
          testID="portfolio-name"
        />
        {onPickCash && (
          <Pressable onPress={onPickCash} accessibilityRole="button" accessibilityLabel={`${portfolioCash()}: ${cashName ?? portfolioCashNone()}`} style={styles.row} testID="portfolio-cash">
            <Text style={styles.rowLabel}>{portfolioCash()}</Text>
            <Text style={styles.rowValue}>{cashName ?? portfolioCashNone()}</Text>
            <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
          </Pressable>
        )}
        {error && <Text style={styles.error}>{portfolioErrorText(error)}</Text>}
        <Button
          label={portfolioSave()}
          onPress={() => void onSave(name).then(code => (code ? setError(code) : onClose()))}
          testID="portfolio-name-save"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  small: { ...MonoText.figureS },
  large: { ...MonoText.figureM },
  sheet: { gap: 12 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  input: { ...MonoText.body, color: MonoColors.text, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card, paddingHorizontal: 14 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
  rowValue: { ...MonoText.bodyS, color: MonoColors.text },
  error: { ...MonoText.caption, color: MonoColors.negative },
});
