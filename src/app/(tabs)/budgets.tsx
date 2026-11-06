// Anggaran (Budgets) tab. Placeholder header only — real content is a later phase.
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { tabLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';

export default function BudgetsScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('budgets')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
});
