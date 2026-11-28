// Add or change one stock (/portfolio/position?portfolio=&id=): search it by name or code, then say how many (lots for
// Indonesia, shares elsewhere) and the average buy price in the stock's own currency.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { nowIso } from '@/core/clock';
import { formatE4, lotSize, parseE4, priceText } from '@/core/price';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { addPosition, editPosition, getPosition, removePosition, saveQuotes } from '@/domain/portfolio';
import { fetchQuote, searchSymbols, type SymbolMatch } from '@/features/portfolio/yahoo';
import {
  backLabel,
  portfolioErrorText,
  portfolioSave,
  positionAvg,
  positionDelete,
  positionGone,
  positionLast,
  positionLots,
  positionNoMatch,
  positionSearch,
  positionSearchButton,
  positionSearchPlaceholder,
  positionShares,
  positionTitleEdit,
  positionTitleNew,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

interface Picked {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  priceE4: number | null;
}

export default function PositionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ portfolio: string; id?: string }>();
  const portfolioId = Number(params.portfolio);
  const editId = params.id ? Number(params.id) : null;
  const { data: existing, isLoading } = useQuery({ queryKey: ['portfolio', 'position', editId], queryFn: () => getPosition(db, editId as number), enabled: editId != null, gcTime: 0 });

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SymbolMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [quantity, setQuantity] = useState<string | null>(null); // null: as stored
  const [price, setPrice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stock: Picked | null = existing ? { symbol: existing.symbol, name: existing.name, exchange: existing.exchange, currency: existing.currency, priceE4: existing.price_e4 } : picked;
  const lot = stock ? lotSize(stock.symbol) : 1;
  const quantityText = quantity ?? (existing ? formatE4(Math.round(existing.qty_e4 / lot)) : '');
  const priceInput = price ?? (existing ? formatE4(existing.avg_price_e4) : '');

  const search = async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await searchSymbols(query);
    setBusy(false);
    if (result.ok) setMatches(result.value);
    else setError(result.error);
  };

  const pick = async (match: SymbolMatch) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await fetchQuote(match.symbol);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    await saveQuotes(db, [result.value], nowIso());
    setPicked({ ...match, currency: result.value.currency, priceE4: result.value.priceE4 });
    setMatches(null);
  };

  const done = async () => {
    await invalidateAfterWrite(queryClient);
    router.back();
  };

  const save = async () => {
    const typed = parseE4(quantityText);
    const qtyE4 = typed == null ? null : typed * lot;
    const avgPriceE4 = parseE4(priceInput);
    const result = existing
      ? await editPosition(db, existing.id, qtyE4, avgPriceE4, nowIso())
      : await addPosition(db, { portfolioId, symbol: stock?.symbol ?? '', name: stock?.name ?? '', exchange: stock?.exchange ?? '', currency: stock?.currency ?? '', qtyE4, avgPriceE4 }, nowIso());
    if (!result.ok) return setError(result.error);
    await done();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={backLabel()} onPress={() => router.back()} testID="stock-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {editId != null ? positionTitleEdit() : positionTitleNew()}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        {editId != null && !isLoading && !existing && <Text style={styles.sub}>{positionGone()}</Text>}

        {editId == null && !stock && (
          <>
            <Text style={styles.label}>{positionSearch()}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              returnKeyType="search"
              placeholder={positionSearchPlaceholder()}
              placeholderTextColor={MonoColors.textDisabled}
              selectionColor={MonoColors.text}
              autoCapitalize="characters"
              accessibilityLabel={positionSearch()}
              style={styles.input}
              testID="stock-search"
            />
            <Button label={positionSearchButton()} onPress={() => void search()} disabled={busy || !query.trim()} testID="stock-search-go" />
            {matches?.length === 0 && <Text style={styles.sub}>{positionNoMatch()}</Text>}
            {matches?.map(match => (
              <Pressable key={match.symbol} onPress={() => void pick(match)} accessibilityRole="button" accessibilityLabel={`${match.symbol}, ${match.name}, ${match.exchange}`} style={({ pressed }) => [styles.match, pressed && styles.pressed]} testID={`match-${match.symbol}`}>
                <Text style={styles.symbol}>{match.symbol}</Text>
                <Text style={styles.sub}>
                  {match.name} · {match.exchange}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {stock && (
          <>
            <View style={styles.card}>
              <Text style={styles.symbol}>{stock.symbol}</Text>
              <Text style={styles.sub}>
                {stock.name} · {stock.exchange}
              </Text>
              {stock.priceE4 != null && <Text style={styles.sub}>{positionLast(priceText(stock.priceE4, stock.currency))}</Text>}
            </View>
            <Text style={styles.label}>{lot > 1 ? positionLots() : positionShares()}</Text>
            <TextInput value={quantityText} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={MonoColors.textDisabled} selectionColor={MonoColors.text} accessibilityLabel={lot > 1 ? positionLots() : positionShares()} style={styles.input} testID="stock-qty" />
            <Text style={styles.label}>{positionAvg(stock.currency)}</Text>
            <TextInput value={priceInput} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={MonoColors.textDisabled} selectionColor={MonoColors.text} accessibilityLabel={positionAvg(stock.currency)} style={styles.input} testID="stock-price" />
            <Button label={portfolioSave()} onPress={() => void save()} testID="stock-save" />
          </>
        )}

        {error && <Text style={styles.error}>{portfolioErrorText(error)}</Text>}

        {existing && <Button label={positionDelete()} variant="secondary" onPress={() => void removePosition(db, existing.id).then(done)} testID="stock-delete" />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase', marginTop: 8 },
  input: { ...MonoText.body, color: MonoColors.text, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card, paddingHorizontal: 14 },
  card: { backgroundColor: MonoColors.surface, borderRadius: 16, borderWidth: 1, borderColor: MonoColors.border, padding: 14, gap: 2 },
  match: { minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: MonoColors.border, paddingVertical: 8 },
  pressed: { opacity: 0.8 },
  symbol: { ...MonoText.bodyStrong, color: MonoColors.text },
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  error: { ...MonoText.bodyS, color: MonoColors.negative },
});
