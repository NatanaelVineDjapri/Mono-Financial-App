// Catat lewat chat (/ai-chat, AI-Chat and AI-Chat-States boards). The person types a transaction
// the way they would say it; the app asks Gemini for a DRAFT, checks it, and shows a card. Nothing
// is written until Simpan. The route only draws: what happens on a tap is src/features/ai_chat/
// chatActions.ts, and every sentence the assistant "says" is written by the app.
//
// The conversation lives in memory (chatStore): it is gone when the app process ends, and an
// unsaved draft is never stored anywhere.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import {
  chooseAmountForDraft,
  chooseOption,
  discardCard,
  recordTransferAsExpense,
  saveSelected,
  sendMessage,
  startEditing,
  toggleDraft,
} from '@/features/ai_chat/chatActions';
import { useChatStore, type ChatMessage } from '@/features/ai_chat/chatStore';
import { useBlockScreenshots } from '@/features/ai_chat/useBlockScreenshots';
import { useChatEnv, useChatNames } from '@/features/ai_chat/useChatEnv';
import { AssistantBubble, UserBubble } from '@/features/ai_chat/ui/Bubbles';
import { ChatHeader } from '@/features/ai_chat/ui/ChatHeader';
import { Composer } from '@/features/ai_chat/ui/Composer';
import { DraftCard, MultiDraftCard } from '@/features/ai_chat/ui/DraftCards';
import { ClarifyCard, ErrorCard, OutOfScopeCard, ProcessingBubble } from '@/features/ai_chat/ui/MessageCards';
import { aiChatOpening, aiChatSuggestions } from '@/i18n';
import { useDisplayName } from '@/features/settings/useDisplayName';
import { MonoColors } from '@/theme/tokens';

export default function AiChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const env = useChatEnv();
  const names = useChatNames();
  const displayName = useDisplayName();
  const hidden = useHideAmounts(s => s.hidden);
  useBlockScreenshots('ai-chat');

  const messages = useChatStore(s => s.messages);
  const processing = useChatStore(s => s.processing);
  const [input, setInput] = useState('');
  const inputValue = useRef('');
  useEffect(() => {
    inputValue.current = input;
  }, [input]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const focusInput = useCallback(() => {
    const handle = inputRef.current ? findNodeHandle(inputRef.current) : null;
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const outcome = await sendMessage(env, text, controller.signal);
      abortRef.current = null;
      // A failed or cancelled message stays in the box; a sent one goes (unless the person has
      // already started typing something else).
      if (outcome === 'sent' && inputValue.current === text) setInput('');
    },
    [env],
  );

  const cancelRequest = useCallback(() => abortRef.current?.abort(), []);
  useEffect(() => () => abortRef.current?.abort(), []);

  const lastUserText = useCallback((): string => {
    const last = [...useChatStore.getState().messages].reverse().find(m => m.role === 'user');
    return last?.role === 'user' ? last.text : '';
  }, []);

  const openEditor = (messageId: string, draftIds?: string[]) => {
    if (startEditing(messageId, draftIds)) router.push('/ai-draft-edit' as never);
  };

  const renderMessage = (message: ChatMessage, isLast: boolean) => {
    if (message.role === 'user') return <UserBubble key={message.id} text={message.text} />;
    const { content } = message;
    switch (content.type) {
      case 'text':
        return <AssistantBubble key={message.id} text={content.text} live={isLast} />;
      case 'drafts': {
        const selected = new Set(content.selected);
        const savedIds = content.saved?.draftIds ?? null;
        const savedDrafts = savedIds ? content.drafts.filter(d => savedIds.includes(d.id)) : content.drafts;
        return (
          <View key={message.id} style={styles.cardColumn}>
            <AssistantBubble text={content.text} live={isLast} />
            <View style={styles.cardIndent}>
              {savedDrafts.length === 1 ? (
                <DraftCard
                  draft={savedDrafts[0]}
                  names={names}
                  hidden={hidden}
                  saved={savedIds != null}
                  saving={content.saving}
                  saveError={content.saveError}
                  onSave={() => {
                    void saveSelected(env, message.id).then(ok => ok && focusInput());
                  }}
                  onEdit={() => openEditor(message.id, [savedDrafts[0].id])}
                  onCancel={() => discardCard(message.id)}
                  onPickAmount={amount => void chooseAmountForDraft(env, message.id, savedDrafts[0].id, amount)}
                  focusOnMount={isLast}
                  testID={`draft-card-${message.id}`}
                />
              ) : (
                <MultiDraftCard
                  drafts={content.drafts}
                  selected={selected}
                  names={names}
                  hidden={hidden}
                  savedDraftIds={savedIds}
                  saving={content.saving}
                  saveError={content.saveError}
                  onToggle={id => void toggleDraft(env, message.id, id)}
                  onSave={() => {
                    void saveSelected(env, message.id).then(ok => ok && focusInput());
                  }}
                  onEditEach={() => openEditor(message.id)}
                  onCancel={() => discardCard(message.id)}
                  onPickAmount={(draftId, amount) => void chooseAmountForDraft(env, message.id, draftId, amount)}
                  focusOnMount={isLast}
                  testID={`draft-card-${message.id}`}
                />
              )}
            </View>
          </View>
        );
      }
      case 'clarify':
        return (
          <ClarifyCard
            key={message.id}
            result={content.result}
            live={isLast}
            onChoose={(field, id) => void chooseOption(env, message.id, field, id)}
            onRecordAsExpense={draftId => void recordTransferAsExpense(env, message.id, draftId)}
            onCancel={() => discardCard(message.id)}
          />
        );
      case 'out_of_scope':
        return (
          <OutOfScopeCard
            key={message.id}
            result={content.result}
            live={isLast}
            onExample={setInput}
            onOpenAccounts={() => router.push('/accounts' as never)}
          />
        );
      case 'error':
        return (
          <ErrorCard
            key={message.id}
            result={content.result}
            live={isLast}
            onManual={() => router.push('/tx/add' as never)}
            onOpenSettings={() => router.push('/ai-setup' as never)}
            onRetry={() => void send(inputValue.current.trim() || lastUserText())}
          />
        );
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ChatHeader topInset={insets.top} onBack={() => router.back()} onSettings={() => router.push('/ai-setup' as never)} />

      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: !reduceMotion })}
        testID="chat-list"
      >
        <AssistantBubble text={aiChatOpening(displayName)} />
        {messages.map((m, i) => renderMessage(m, i === messages.length - 1))}
        {processing && <ProcessingBubble onCancel={cancelRequest} />}
      </ScrollView>

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => void send(input)}
        processing={processing}
        suggestions={aiChatSuggestions()}
        onPickSuggestion={setInput}
        inputRef={inputRef}
        bottomInset={insets.bottom}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 16 },
  cardColumn: { gap: 8 },
  cardIndent: { paddingLeft: 40 },
});
