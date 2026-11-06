// Akun (Accounts) tab. Placeholder header only — real content lands later this phase.
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { tabLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';

export default function AccountsScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('accounts')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
});
