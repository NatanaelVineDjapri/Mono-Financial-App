// "Nama panggilan": a sheet with one field and Simpan. Empty is allowed (it clears the nickname and the Overview
// greets with its default). The field is filled from the saved name each time the sheet opens.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { NICKNAME_MAX_LENGTH } from '@/features/welcome/welcomeState';
import { cancelLabel, profileNicknameHint, profileNicknamePlaceholder, profileNicknameSave, profileNicknameSheetSubtitle, profileNicknameTitle } from '@/i18n';

import { cleanNickname } from './nickname';

export interface NicknameSheetProps {
  visible: boolean;
  value: string; // the saved nickname ('' when none)
  onSave: (name: string) => void;
  onClose: () => void;
}

export function NicknameSheet({ visible, value, onSave, onClose }: NicknameSheetProps) {
  const [text, setText] = useState(value);
  // The field starts from the saved name each time the sheet opens (React's "adjust state when a prop changes" recipe).
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setText(value);
  }

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={cancelLabel()} testID="nickname-sheet">
      <SheetHeader visible={visible} icon="pencil" title={profileNicknameTitle()} subtitle={profileNicknameSheetSubtitle()} onClose={onClose} />
      <View style={styles.body}>
        <Field
          value={text}
          onChangeText={next => setText(next.slice(0, NICKNAME_MAX_LENGTH))}
          placeholder={profileNicknamePlaceholder()}
          helperText={profileNicknameHint()}
          maxLength={NICKNAME_MAX_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => onSave(cleanNickname(text))}
          accessibilityLabel={profileNicknameTitle()}
          testID="nickname-field"
        />
        <Button label={profileNicknameSave()} onPress={() => onSave(cleanNickname(text))} testID="nickname-save" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 8 },
});
