// Ringkasan (Overview) tab. Placeholder header only — real content is Phase 4.2+. Its own
// richer header replaces ScreenHeader in a later phase.
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { tabLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';

export default function OverviewScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('overview')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
});
