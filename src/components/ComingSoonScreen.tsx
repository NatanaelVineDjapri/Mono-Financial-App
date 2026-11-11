// A placeholder for a route whose screen is not built yet: a back arrow, the title and one
// sentence. It keeps the route real (so the + menu, links and deep links land somewhere
// sensible) until the screen replaces it.
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { backLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export function ComingSoonScreen({ title, message }: { title: string; message: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <IconButton label={backLabel()} onPress={() => router.back()}>
            <Icon name="chevron-left" color={MonoColors.text} />
          </IconButton>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        </View>
      </View>
      <View style={styles.centerFill}>
        <Text style={styles.body}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12 },
  headerRow: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  body: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
