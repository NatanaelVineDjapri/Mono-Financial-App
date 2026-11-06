// Transaksi (Transactions) tab. Placeholder header only — real content is Phase 4.3+.
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { tabLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';

export default function TransactionsScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('transactions')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
});
