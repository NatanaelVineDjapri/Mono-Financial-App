// Add transaction (/tx/add), the Manual choice of the + menu: Income, Expense or Transfer in one
// form. `?type=income|expense|transfer` picks the starting segment. A static route, so it wins
// over /tx/[id]. The route only wires data and navigation; the form is
// src/features/transactions/form/TransactionForm.tsx and the rules are src/core/tx/validate.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { today as todayLocal } from '@/core/clock';
import type { TxType } from '@/core/tx/validate';
import { TransactionForm } from '@/features/transactions/form/TransactionForm';
import { useAddSubmit, useTxFormData } from '@/features/transactions/form/useTxForm';
import { useDb } from '@/data/db/DbProvider';
import { getSetting } from '@/data/repo/settings';
import { captureForegroundLocation, type CapturedLocation } from '@/features/location/capture';
import { retryLabel, txDetailLoadError } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const TYPES: TxType[] = ['income', 'expense', 'transfer'];

// A query parameter as a positive whole number, or undefined when it is missing or unusable:
// a hand-typed deep link must never hand the form a NaN.
function numericParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export default function AddTransactionScreen() {
  const router = useRouter();
  const db = useDb();
  // `?to=` prefills a transfer's destination; `?category=`, `?amount=`, `?place=` and
  // `?description=` fill in a quick record (Overview's "Catat cepat") so a repeated entry
  // needs one Save.
  const { type, account, to, category, amount, place, description } = useLocalSearchParams<{
    type?: string;
    account?: string;
    to?: string;
    category?: string;
    amount?: string;
    place?: string;
    description?: string;
  }>();
  const initialType = TYPES.find(t => t === type);
  const { data, isLoading, isError, refetch } = useTxFormData();
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'capturing' | 'ready' | 'unavailable'>('idle');
  const [placeName, setPlaceName] = useState(place?.slice(0, 60) ?? '');
  const capture = useCallback(async () => {
    setLocationStatus('capturing');
    const next = await captureForegroundLocation();
    setLocation(next);
    setLocationStatus(next ? 'ready' : 'unavailable');
  }, []);
  useEffect(() => {
    let active = true;
    void getSetting(db, 'location_enabled').then(enabled => {
      if (active && enabled === '1') void capture();
    });
    return () => { active = false; };
  }, [db, capture]);
  const onSubmit = useAddSubmit(data, 'manual', location ? { ...location, placeName } : null);
  // The date is read once per visit: the form judges "later than today" against one fixed day.
  const today = useMemo(() => todayLocal(), []);

  if (isLoading) return <View style={styles.screen} />;
  if (isError || !data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{txDetailLoadError()}</Text>
        <Button label={retryLabel()} onPress={() => void refetch()} />
      </View>
    );
  }

  return (
    <TransactionForm
      mode="add"
      data={data}
      today={today}
      initialType={initialType}
      initialAccountId={numericParam(account)}
      initialToAccountId={numericParam(to)}
      initialCategoryId={numericParam(category)}
      initialAmount={numericParam(amount)}
      initialDescription={description}
      onCancel={() => router.back()}
      onSetRates={() => router.push('/settings/rates' as never)}
      onSubmit={onSubmit}
      locationStatus={locationStatus}
      onLocationPress={() => {
        if (location) {
          setLocation(null);
          setLocationStatus('idle');
        } else void capture();
      }}
      placeName={placeName}
      onPlaceNameChange={setPlaceName}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
