// Rates (/settings/rates, board V7). The route only wires data, the two actions and the sheet where a
// person types their own rate; the screen is src/features/fx/RatesView.tsx and the rules (the
// throttle, keeping the stored rates on a failure) are src/domain/fx.ts.
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { showToast } from '@/components/toast-store';
import { currencySymbol } from '@/core/money';
import { RatesView, type RatesFailure } from '@/features/fx/RatesView';
import { minutesSince } from '@/features/fx/throttle';
import { useRatesActions, useRatesOverview } from '@/features/fx/useRates';
import {
  currencyName,
  ratesCloseLabel,
  ratesCooldown,
  ratesManualInvalid,
  ratesManualLabel,
  ratesManualSave,
  ratesManualSaved,
  ratesManualSubtitle,
  ratesManualTitle,
  ratesNoPockets,
  ratesUpdatedToast,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';

const LOCKOUT_MINUTES = 20;

export default function RatesRoute() {
  const router = useRouter();
  const { data } = useRatesOverview();
  const actions = useRatesActions();
  const [updating, setUpdating] = useState(false);
  const [failure, setFailure] = useState<RatesFailure | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const onBack = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/more' as never)), [router]);

  const onUpdateNow = useCallback(async () => {
    setUpdating(true);
    setFailure(null);
    try {
      const outcome = await actions.refresh();
      if (outcome.status === 'updated') showToast(ratesUpdatedToast());
      else if (outcome.status === 'failed') setFailure({ kind: outcome.kind, minutesLeft: outcome.kind === 'rate_limited' ? LOCKOUT_MINUTES : undefined });
      else if (outcome.status === 'skipped_locked') setFailure({ kind: 'rate_limited', minutesLeft: Math.max(1, LOCKOUT_MINUTES - minutesSince(outcome.lockedUntil)) });
      else if (outcome.status === 'skipped_cooldown') showToast(ratesCooldown(Math.max(1, 60 - minutesSince(outcome.lastSuccessAt))));
      else showToast(ratesNoPockets());
    } finally {
      setUpdating(false);
    }
  }, [actions]);

  const openEditor = useCallback((currency: string) => {
    setEditing(currency);
    setText('');
    setInvalid(false);
  }, []);

  const closeEditor = useCallback(() => setEditing(null), []);

  const onSaveManual = useCallback(async () => {
    if (!editing) return;
    const ok = await actions.saveManual(editing, text);
    if (!ok) {
      setInvalid(true);
      return;
    }
    showToast(ratesManualSaved(editing));
    setEditing(null);
  }, [actions, editing, text]);

  return (
    <>
      <RatesView
        rows={data?.rows ?? []}
        autoUpdate={data?.autoUpdate ?? false}
        lastSuccessAt={data?.lastSuccessAt ?? null}
        updating={updating}
        failure={failure}
        onBack={onBack}
        onToggleAuto={on => void actions.setAuto(on)}
        onUpdateNow={() => void onUpdateNow()}
        onEditRate={openEditor}
      />
      <Sheet visible={editing != null} onClose={closeEditor} closeLabel={ratesCloseLabel()} testID="rates-manual-sheet">
        {editing != null && (
          <View style={styles.sheet}>
            <SheetHeader
              visible
              icon="refresh"
              title={ratesManualTitle(editing)}
              subtitle={ratesManualSubtitle(currencyName(editing))}
              onClose={closeEditor}
              closeTestID="rates-manual-close"
            />
            <Field
              label={ratesManualLabel(currencySymbol(editing))}
              value={text}
              onChangeText={value => {
                setText(value);
                setInvalid(false);
              }}
              keyboardType="decimal-pad"
              placeholder="16.250"
              placeholderTextColor={MonoColors.textDisabled}
              error={invalid ? ratesManualInvalid() : undefined}
              autoFocus
              testID="rates-manual-input"
            />
            <Button label={ratesManualSave()} onPress={() => void onSaveManual()} disabled={text.trim().length === 0} style={styles.save} testID="rates-manual-save" />
          </View>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 16, paddingBottom: 16 },
  save: { marginTop: 16 },
});
