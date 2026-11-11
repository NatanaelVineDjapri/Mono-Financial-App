// Ubah draf (/ai-draft-edit, AI-Draft-Edit board, PAGES.md K4): the AI's drafts one by one in the
// ordinary transaction form (same fields, same validation, same save). "Simpan dan lanjut" SAVES
// this draft (through the same writer, source 'ai') and opens the next; "Lewati" opens the next
// without saving. Closing early asks "Buang perubahan?": what was already saved stays saved. Back
// in the chat, the card shows what was saved and the snackbar offers one Urungkan for the batch.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { today as todayLocal } from '@/core/clock';
import { draftFormValues, finishEditing, saveEditedDraft } from '@/features/ai_chat/chatActions';
import { useChatStore } from '@/features/ai_chat/chatStore';
import { useChatEnv } from '@/features/ai_chat/useChatEnv';
import { TransactionForm, type SubmitResult } from '@/features/transactions/form/TransactionForm';
import { useTxFormData } from '@/features/transactions/form/useTxForm';
import { aiBackLabel, aiEditDiscardConfirm, aiEditDiscardMessage, aiEditDiscardTitle, aiEditKeepEditing, aiEditNothingToEdit, aiLoadErrorMessage, aiRetryLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function AiDraftEditScreen() {
  const router = useRouter();
  const env = useChatEnv();
  const edit = useChatStore(s => s.edit);
  const { data, isLoading, isError, refetch } = useTxFormData();
  const [index, setIndex] = useState(0);
  const [confirmingClose, setConfirmingClose] = useState(false);
  // The date is read once per visit: the form judges "later than today" against one fixed day.
  const today = useMemo(() => todayLocal(), []);

  const leave = useCallback(async () => {
    await finishEditing(env);
    router.back();
  }, [env, router]);

  // The next draft, or back to the chat after the last one.
  const advance = useCallback(async () => {
    if (!edit || index + 1 >= edit.drafts.length) {
      await leave();
      return;
    }
    setIndex(index + 1);
  }, [edit, index, leave]);

  // Android back asks before it throws away what is still open.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setConfirmingClose(true);
      return true;
    });
    return () => subscription.remove();
  }, []);

  if (!edit) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{aiEditNothingToEdit()}</Text>
        <Button label={aiBackLabel()} onPress={() => router.back()} />
      </View>
    );
  }
  if (isLoading) return <View style={styles.screen} />;
  if (isError || !data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{aiLoadErrorMessage()}</Text>
        <Button label={aiRetryLabel()} onPress={() => void refetch()} />
      </View>
    );
  }

  const draft = edit.drafts[index];

  const onSubmit = async (values: Parameters<typeof saveEditedDraft>[2]): Promise<SubmitResult> => {
    const result = await saveEditedDraft(env, draft, values);
    if (!result.ok) return result;
    await refetch(); // the next draft is judged against the balances this one just changed
    await advance();
    return { ok: true };
  };

  return (
    <View style={styles.screen}>
      <TransactionForm
        key={draft.id}
        mode="draft"
        draft={{ index, total: edit.drafts.length, sourceMessage: edit.sourceMessage, initialValues: draftFormValues(draft), onSkip: () => void advance() }}
        data={data}
        today={today}
        onCancel={() => setConfirmingClose(true)}
        onSubmit={onSubmit}
      />
      <ConfirmDialog
        visible={confirmingClose}
        icon="alert"
        title={aiEditDiscardTitle()}
        message={[{ text: aiEditDiscardMessage() }]}
        cancelLabel={aiEditKeepEditing()}
        confirmLabel={aiEditDiscardConfirm()}
        onCancel={() => setConfirmingClose(false)}
        onConfirm={() => {
          setConfirmingClose(false);
          void leave();
        }}
        testID="discard-dialog"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
