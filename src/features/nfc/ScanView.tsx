// Scan card (board Nfc-Tap) and the states that replace it (board Nfc-States): NFC off, a card that is not supported,
// a card taken away too soon. Each state is a circle with its icon, a title and a sentence in the middle, and its buttons in
// the bar at the bottom. Plain props in, callbacks out: the screen's route owns the reader, this only draws.
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import type { ScanState } from '@/domain/cards/scanState';
import {
  cancelLabel,
  nfcEmoneyOnlyChip,
  nfcFillManually,
  nfcLostBody,
  nfcLostTitle,
  nfcOffBody,
  nfcOffTitle,
  nfcOpenSettings,
  nfcReadingBody,
  nfcReadingTitle,
  nfcScanAnother,
  nfcScanTitle,
  nfcTapBody,
  nfcTapTitle,
  nfcTryAgain,
  nfcUnsupportedBody,
  nfcUnsupportedTitle,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { BottomBar, NfcHeader, nfcStyles } from './parts';

export interface ScanViewProps {
  state: ScanState;
  onCancel: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
  onManual: () => void;
}

export function ScanView({ state, onCancel, onRetry, onOpenSettings, onManual }: ScanViewProps) {
  let middle;
  let buttons;
  switch (state.status) {
    case 'nfcOff':
      middle = <Message icon="nfc-off" title={nfcOffTitle()} text={nfcOffBody()} testID="nfc-state-off" />;
      buttons = (
        <>
          <Button label={nfcOpenSettings()} onPress={onOpenSettings} testID="nfc-open-settings" />
          <Button label={nfcFillManually()} variant="secondary" onPress={onManual} testID="nfc-manual" />
        </>
      );
      break;
    case 'unsupported':
      middle = <Message icon="card" title={nfcUnsupportedTitle()} text={nfcUnsupportedBody()} testID="nfc-state-unsupported" />;
      buttons = (
        <>
          <Button label={nfcScanAnother()} onPress={onRetry} testID="nfc-scan-another" />
          <Button label={nfcFillManually()} variant="secondary" onPress={onManual} testID="nfc-manual" />
        </>
      );
      break;
    case 'lost':
      middle = <Message icon="refresh" title={nfcLostTitle()} text={nfcLostBody()} testID="nfc-state-lost" />;
      buttons = (
        <>
          <Button label={nfcTryAgain()} onPress={onRetry} testID="nfc-try-again" />
          <Button label={cancelLabel()} variant="secondary" onPress={onCancel} testID="nfc-cancel" />
        </>
      );
      break;
    default: {
      const reading = state.status === 'reading';
      middle = (
        <View style={styles.center} testID={reading ? 'nfc-state-reading' : 'nfc-state-waiting'}>
          <TapArt still={reading} />
          <Text style={styles.title} accessibilityRole="header">
            {reading ? nfcReadingTitle() : nfcTapTitle()}
          </Text>
          <Text style={styles.text} accessibilityLiveRegion="polite">
            {reading ? nfcReadingBody() : nfcTapBody()}
          </Text>
          <View style={styles.chip}>
            <Icon name="nfc" size={16} color={MonoColors.textSecond} />
            <Text style={styles.chipText}>{nfcEmoneyOnlyChip()}</Text>
          </View>
        </View>
      );
      buttons = <Button label={cancelLabel()} variant="secondary" onPress={onCancel} testID="nfc-cancel" />;
    }
  }

  return (
    <View style={nfcStyles.screen} testID="nfc-scan">
      <NfcHeader title={nfcScanTitle()} onClose={onCancel} testID="nfc-close" />
      <ScrollView contentContainerStyle={styles.content}>{middle}</ScrollView>
      <BottomBar>{buttons}</BottomBar>
    </View>
  );
}

function Message({ icon, title, text, testID }: { icon: IconName; title: string; text: string; testID: string }) {
  return (
    <View style={styles.center} testID={testID}>
      <View style={styles.disc}>
        <Icon name={icon} size={28} color={MonoColors.textSecond} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

// A card held to the back of a phone: two outlines and a ring that breathes. Decoration only (hidden from a screen
// reader); it holds still when the phone is set to reduce motion, and while the card is being read.
function TapArt({ still }: { still: boolean }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced || still) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return undefined;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduced, still, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.25 + pulse.value * 0.55, transform: [{ scale: 0.92 + pulse.value * 0.16 }] }));

  return (
    <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.ring, ring]} />
      <View style={styles.phone}>
        <View style={styles.camera} />
      </View>
      <View style={styles.card}>
        <View style={styles.cardChip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, justifyContent: 'center' },
  center: { alignItems: 'center', gap: 12 },
  title: { ...MonoText.titleM, fontSize: 20, lineHeight: 28, color: MonoColors.text, textAlign: 'center' },
  text: { ...MonoText.bodyS, color: MonoColors.textSecond, textAlign: 'center' },
  chip: { minHeight: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 18, backgroundColor: MonoColors.card, marginTop: 4 },
  chipText: { ...MonoText.bodyS, color: MonoColors.text },
  disc: { width: 72, height: 72, borderRadius: 36, backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },

  art: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ring: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1.5, borderColor: MonoColors.accent },
  phone: { width: 96, height: 176, borderRadius: radius.lg, borderWidth: 2, borderColor: MonoColors.textSecond, backgroundColor: MonoColors.surface, alignItems: 'center', paddingTop: 10 },
  camera: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: MonoColors.textSecond },
  card: { position: 'absolute', width: 96, height: 62, borderRadius: radius.md, borderWidth: 2, borderColor: MonoColors.text, backgroundColor: MonoColors.card, bottom: 36, right: 28, padding: 8, transform: [{ rotate: '-12deg' }] },
  cardChip: { width: 20, height: 15, borderRadius: 3, borderWidth: 1.5, borderColor: MonoColors.accent },
});
