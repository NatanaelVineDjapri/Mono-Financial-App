// Import-Permission (board): the guide for notification access on Android 13 and up. MONO is
// installed outside the Play Store, so Android keeps "Notification access" locked until the person
// has opened the app info, the three dots and "Allow restricted settings". Four steps, a
// reassurance line, and the buttons "Buka pengaturan Android" and "Nanti saja".
//
// It only opens when the permission is not on (the screen decides); once it is on, the guide is
// never shown again.
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import {
  closeLabel,
  importGuideDirect,
  importGuideLater,
  importGuideLead,
  importGuideNote,
  importGuideOpen,
  importGuideStepSub,
  importGuideStepTitle,
  importGuideSubtitle,
  importGuideTitle,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface ImportPermissionSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void; // the app's info page (step 1)
  onOpenAccess: () => void; // straight to Notification access (phones without the extra step)
}

const STEPS = [1, 2, 3, 4];

export function ImportPermissionSheet({ visible, onClose, onOpenSettings, onOpenAccess }: ImportPermissionSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="import-guide">
      <View style={styles.sheet}>
        <SheetHeader visible={visible} icon="bell" title={importGuideTitle()} subtitle={importGuideSubtitle()} onClose={onClose} closeTestID="import-guide-close" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.lead}>{importGuideLead()}</Text>
          <View style={styles.steps}>
            {STEPS.map((step, index) => (
              <View key={step} style={[styles.step, index > 0 && styles.stepSeparator]} testID={`import-guide-step-${step}`}>
                <View style={styles.number}>
                  <Text style={styles.numberText}>{step}</Text>
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{importGuideStepTitle(step)}</Text>
                  <Text style={styles.stepSub}>{importGuideStepSub(step)}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.note}>
            <Icon name="lock" size={18} color={MonoColors.text} />
            <Text style={styles.noteText}>{importGuideNote()}</Text>
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <Button label={importGuideOpen()} onPress={onOpenSettings} testID="import-guide-open" />
          <Pressable onPress={onOpenAccess} accessibilityRole="button" style={styles.link} testID="import-guide-direct">
            <Text style={styles.linkText}>{importGuideDirect()}</Text>
          </Pressable>
          <Button label={importGuideLater()} variant="secondary" onPress={onClose} testID="import-guide-later" />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: 700, paddingHorizontal: 20 },
  scroll: { flexShrink: 1, minHeight: 0 },
  content: { paddingTop: 12, paddingBottom: 8, gap: 12 },
  lead: { ...MonoText.bodyS, color: MonoColors.textSecond },
  steps: { backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 16, paddingHorizontal: 16 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12 },
  stepSeparator: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  number: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: MonoColors.textDisabled, alignItems: 'center', justifyContent: 'center' },
  numberText: { ...MonoText.chip, color: MonoColors.text },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { ...MonoText.h2, color: MonoColors.text },
  stepSub: { ...MonoText.caption, color: MonoColors.textMeta },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.surface, borderRadius: 16, padding: 12 },
  noteText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
  actions: { gap: 8, paddingTop: 8 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...MonoText.chip, color: MonoColors.text, textDecorationLine: 'underline' },
});
