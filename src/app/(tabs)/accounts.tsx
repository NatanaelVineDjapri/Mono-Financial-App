// Akun (Accounts) tab. Placeholder app bar only — real content is Phase 4.2+.
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>{tabLabel('accounts')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { ...MonoText.titleL, color: MonoColors.text },
});
