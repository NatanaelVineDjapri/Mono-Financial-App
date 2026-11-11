// A problem, stated in words with an icon, in a 1.5 px red frame (#FF6B6B). The red only
// reinforces the icon and the sentence; it is never the only signal. Used for a draft that cannot
// be saved, an amount that needs checking and a failed save.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { CHAT, ERROR_BORDER_WIDTH } from './chatTheme';

export interface NoticeProps {
  title?: string; // a short bold lead
  text: string;
  children?: ReactNode; // the ways out: buttons
  testID?: string;
}

export function Notice({ title, text, children, testID }: NoticeProps) {
  return (
    <View style={styles.box} testID={testID}>
      <View style={styles.row} accessible accessibilityRole="alert" accessibilityLabel={[title, text].filter(Boolean).join(' ')}>
        <Icon name="alert" size={20} color={MonoColors.negative} />
        <View style={styles.words}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          <Text style={styles.text}>{text}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: ERROR_BORDER_WIDTH, borderColor: CHAT.errorBorder, borderRadius: radius.md, padding: 12, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  words: { flex: 1, gap: 2 },
  title: { ...MonoText.bodyStrong, color: MonoColors.text },
  text: { ...MonoText.bodyS, color: MonoColors.text, lineHeight: 20 },
});
