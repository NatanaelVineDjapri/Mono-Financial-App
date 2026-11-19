// "Financial Insights" banner: a sleek card below the hero navigating to /analysis.
// Features a gold spark icon badge, bold title, descriptive subtitle, and chevron arrow.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { analysisBannerSub, analysisBannerTitle } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export function AnalysisBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${analysisBannerTitle()}. ${analysisBannerSub()}`}
      android_ripple={undefined}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      testID="overview-analysis-banner"
    >
      <View style={styles.disc}>
        <Icon name="spark" size={20} color={MonoColors.accent} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{analysisBannerTitle()}</Text>
        <Text style={styles.sub} numberOfLines={1}>{analysisBannerSub()}</Text>
      </View>
      <View style={styles.arrowBtn}>
        <Icon name="chevron-right" size={16} color={MonoColors.accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: MonoColors.card,
    borderWidth: 1,
    borderColor: MonoColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  disc: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: MonoColors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...MonoText.bodyStrong,
    color: MonoColors.text,
  },
  sub: {
    ...MonoText.caption,
    color: MonoColors.textSecond,
    marginTop: 2,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MonoColors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
