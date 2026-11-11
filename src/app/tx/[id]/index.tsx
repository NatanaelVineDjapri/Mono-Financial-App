// Transaction detail stub (Phase 5/6) — Transactions' row tap target exists now, but the
// real detail/edit screen doesn't yet.
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Icon } from '@/components/Icon';
import { closeLabel, comingSoonMessage, transactionDetailTitle } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <IconButton label={closeLabel()} onPress={() => router.back()}>
          <Icon name="close" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title}>{transactionDetailTitle()}</Text>
      </View>
      <View style={styles.centerFill}>
        <Text style={styles.body}>{comingSoonMessage()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { ...MonoText.body, color: MonoColors.textSecond },
});
