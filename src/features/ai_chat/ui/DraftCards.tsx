// The draft cards (AI-Chat board). A draft is a proposal, so its frame is dashed (1.5 px #737373)
// on #101011 until it is saved; saved, the frame is a plain 1 px line. Nothing here saves: the
// buttons call back. A draft that cannot be saved says why, in words and an icon (the red frame
// only reinforces them), and offers the ways out.
import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { rp, shown } from '@/core/money';
import {
  aiDraftBalanceAfterRow,
  aiDraftCancelButton,
  aiDraftCheckboxLabel,
  aiDraftEditButton,
  aiDraftLockedBlocked,
  aiDraftLockedCheckAmount,
  aiDraftLockedNeeds,
  aiDraftSaveButton,
  aiDraftSavedBadge,
  aiDraftSavingLabel,
  aiDraftTag,
  aiDraftUnsaved,
  aiDraftsA11y,
  aiDraftsEditEach,
  aiDraftsHeading,
  aiDraftsSaveN,
  aiDraftsTotalRow,
  aiMsgChangeAccount,
  aiMsgChangeAmount,
  aiMsgUseAmount,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { canSave } from '../saveDrafts';
import type { Draft } from '../draft';
import { blockedText, checkAmountText } from '../messages';
import { CHAT, CHECKBOX_RADIUS, CHECKBOX_SIZE, DRAFT_BORDER_WIDTH } from './chatTheme';
import { amountView, batchSummary, draftKind, draftRows, draftSpokenLabel, draftTitle, type Names } from './draftView';
import { Notice } from './Notice';

// ---------------------------------------------------------------- shared pieces

function useFocusOnMount(enabled: boolean) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!enabled) return;
    const handle = ref.current ? findNodeHandle(ref.current) : null;
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [enabled]);
  return ref;
}

function Frame({ saved, children, testID }: { saved: boolean; children: ReactNode; testID?: string }) {
  return (
    <View style={[styles.frame, saved ? styles.frameSaved : styles.frameDraft]} testID={testID}>
      {children}
    </View>
  );
}

function TagRow({ tag, saved }: { tag: string; saved: boolean }) {
  return (
    <View style={styles.tagRow}>
      <View style={styles.tag}>
        <Text style={styles.tagText}>{tag}</Text>
      </View>
      <View style={styles.statusRow}>
        {saved && <Icon name="check" size={16} color={MonoColors.textSecond} />}
        <Text style={styles.status}>{saved ? aiDraftSavedBadge() : aiDraftUnsaved()}</Text>
      </View>
    </View>
  );
}

function LinkButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.link} hitSlop={4} testID={testID}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function useFormat(hidden: boolean) {
  return (n: number) => shown(rp(n), hidden);
}

// "Nominal perlu dicek. Kamu mengetik “40rb” (Rp40.000), drafnya Rp4.000." and one button per amount.
function CheckAmountNotice({ draft, hidden, onPick }: { draft: Draft; hidden: boolean; onPick: (amount: number) => void }) {
  const format = useFormat(hidden);
  const text = checkAmountText(draft, format);
  if (!text || !draft.amountCheck) return null;
  return (
    <Notice text={text} testID={`check-amount-${draft.id}`}>
      <View style={styles.choices}>
        {draft.amountCheck.choices.map(choice => (
          <Button key={choice} label={aiMsgUseAmount(format(choice))} variant="secondary" onPress={() => onPick(choice)} style={styles.choice} testID={`use-amount-${draft.id}-${choice}`} />
        ))}
      </View>
    </Notice>
  );
}

function BlockedNotice({ draft, hidden, children }: { draft: Draft; hidden: boolean; children?: ReactNode }) {
  const message = blockedText(draft, useFormat(hidden));
  if (!message) return null;
  return (
    <Notice title={message.lead} text={message.reason} testID={`blocked-${draft.id}`}>
      {children}
    </Notice>
  );
}

// ---------------------------------------------------------------- one draft

export interface DraftCardProps {
  draft: Draft;
  names: Names;
  hidden: boolean;
  saved: boolean;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onPickAmount: (amount: number) => void;
  focusOnMount?: boolean;
  testID?: string;
}

export function DraftCard({ draft, names, hidden, saved, saving, saveError, onSave, onEdit, onCancel, onPickAmount, focusOnMount = false, testID }: DraftCardProps) {
  const kind = draftKind(draft);
  const amount = amountView(kind, draft.amount, hidden);
  const summaryRef = useFocusOnMount(focusOnMount);
  const saveEnabled = canSave(draft) && !saving && !saved;

  return (
    <Frame saved={saved} testID={testID}>
      <View ref={summaryRef} accessible accessibilityLabel={draftSpokenLabel(draft, names, hidden, saved)} style={styles.summary}>
        <TagRow tag={aiDraftTag(kind)} saved={saved} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>{draftTitle(draft)}</Text>
          <Text style={[styles.amount, { color: amount.color }]}>{amount.text}</Text>
        </View>
        <View style={styles.rows}>
          {draftRows(draft, names, hidden).map(row => (
            <View key={row.key} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {!saved && draft.status.kind === 'check_amount' && <CheckAmountNotice draft={draft} hidden={hidden} onPick={onPickAmount} />}
      {!saved && draft.status.kind === 'blocked' && (
        <BlockedNotice draft={draft} hidden={hidden}>
          <View style={styles.choices}>
            <Button label={aiMsgChangeAccount()} variant="secondary" onPress={onEdit} style={styles.choice} testID={`change-account-${draft.id}`} />
            <Button label={aiMsgChangeAmount()} variant="secondary" onPress={onEdit} style={styles.choice} testID={`change-amount-${draft.id}`} />
          </View>
        </BlockedNotice>
      )}
      {!!saveError && <Notice text={saveError} testID="save-error" />}

      {!saved && (
        <View style={styles.actions}>
          <View style={styles.buttons}>
            <Button label={saving ? aiDraftSavingLabel() : aiDraftSaveButton()} onPress={onSave} disabled={!saveEnabled} loading={false} style={styles.grow} testID="draft-save" />
            <Button label={aiDraftEditButton()} variant="secondary" onPress={onEdit} style={styles.grow} testID="draft-edit" />
          </View>
          <LinkButton label={aiDraftCancelButton()} onPress={onCancel} testID="draft-cancel" />
        </View>
      )}
    </Frame>
  );
}

// ---------------------------------------------------------------- several drafts

export interface MultiDraftCardProps {
  drafts: Draft[];
  selected: ReadonlySet<string>;
  names: Names;
  hidden: boolean;
  savedDraftIds: readonly string[] | null; // the rows that were saved, when the card is saved
  saving: boolean;
  saveError: string | null;
  onToggle: (draftId: string) => void;
  onSave: () => void;
  onEditEach: () => void;
  onCancel: () => void;
  onPickAmount: (draftId: string, amount: number) => void;
  focusOnMount?: boolean;
  testID?: string;
}

function lockedReason(draft: Draft): string | null {
  switch (draft.status.kind) {
    case 'needs':
      return aiDraftLockedNeeds();
    case 'check_amount':
      return aiDraftLockedCheckAmount();
    case 'blocked':
      return aiDraftLockedBlocked();
    default:
      return null;
  }
}

function Checkbox({ checked, locked }: { checked: boolean; locked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxOn, locked && styles.checkboxLocked]}>
      {checked && <Icon name="check" size={16} color={MonoColors.bg} />}
      {locked && <Icon name="lock" size={16} color={MonoColors.textDisabled} />}
    </View>
  );
}

export function MultiDraftCard({
  drafts,
  selected,
  names,
  hidden,
  savedDraftIds,
  saving,
  saveError,
  onToggle,
  onSave,
  onEditEach,
  onCancel,
  onPickAmount,
  focusOnMount = false,
  testID,
}: MultiDraftCardProps) {
  const format = useFormat(hidden);
  const saved = savedDraftIds != null;
  const shownDrafts = saved ? drafts.filter(d => savedDraftIds.includes(d.id)) : drafts;
  const summary = batchSummary(shownDrafts, saved ? new Set(savedDraftIds) : selected, hidden);
  const headRef = useFocusOnMount(focusOnMount);

  return (
    <Frame saved={saved} testID={testID}>
      <View ref={headRef} accessible accessibilityLabel={aiDraftsA11y(shownDrafts.length, summary.total.text)} style={styles.summary}>
        <TagRow tag={aiDraftsHeading(shownDrafts.length)} saved={saved} />
      </View>

      <View style={styles.list}>
        {shownDrafts.map(draft => {
          const kind = draftKind(draft);
          const amount = amountView(kind, draft.amount, hidden);
          const locked = saved ? null : lockedReason(draft);
          const checked = selected.has(draft.id);
          const details = draftRows(draft, names, hidden)
            .filter(r => r.key === 'category' || r.key === 'account' || r.key === 'to')
            .map(r => r.value)
            .join(' · ');
          const content = (
            <>
              {!saved && <Checkbox checked={checked} locked={locked != null} />}
              <View style={styles.rowText}>
                <Text style={styles.itemTitle}>{draftTitle(draft)}</Text>
                <Text style={styles.itemSub}>{details}</Text>
                {!!locked && (
                  <View style={styles.lockedRow}>
                    <Icon name="alert" size={16} color={MonoColors.negative} />
                    <Text style={styles.lockedText}>{locked}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.itemAmount, { color: amount.color }]}>{amount.text}</Text>
            </>
          );
          return (
            <View key={draft.id} style={styles.item}>
              {saved ? (
                <View style={styles.itemRow}>{content}</View>
              ) : (
                <Pressable
                  onPress={() => onToggle(draft.id)}
                  disabled={locked != null}
                  accessibilityRole="checkbox"
                  accessibilityLabel={aiDraftCheckboxLabel(draftTitle(draft), checked, locked)}
                  accessibilityState={{ checked, disabled: locked != null }}
                  style={styles.itemRow}
                  testID={`draft-row-${draft.id}`}
                >
                  {content}
                </Pressable>
              )}
              {!saved && draft.status.kind === 'check_amount' && <CheckAmountNotice draft={draft} hidden={hidden} onPick={a => onPickAmount(draft.id, a)} />}
              {!saved && draft.status.kind === 'blocked' && <BlockedNotice draft={draft} hidden={hidden} />}
            </View>
          );
        })}
      </View>

      <View style={styles.totals}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{aiDraftsTotalRow()}</Text>
          <Text style={[styles.rowValue, { color: summary.total.color }]}>{summary.total.text}</Text>
        </View>
        {summary.balances.map(b => (
          <View key={b.accountId} style={styles.row}>
            <Text style={styles.rowLabel}>{aiDraftBalanceAfterRow(names.accounts.get(b.accountId) ?? '')}</Text>
            <Text style={styles.rowValue}>{format(b.balanceAfter)}</Text>
          </View>
        ))}
      </View>

      {!!saveError && <Notice text={saveError} testID="save-error" />}

      {!saved && (
        <View style={styles.actions}>
          <Button
            label={saving ? aiDraftSavingLabel() : aiDraftsSaveN(summary.count)}
            onPress={onSave}
            disabled={summary.count === 0 || saving}
            testID="drafts-save"
          />
          <Button label={aiDraftsEditEach()} variant="secondary" onPress={onEditEach} testID="drafts-edit-each" />
          <LinkButton label={aiDraftCancelButton()} onPress={onCancel} testID="draft-cancel" />
        </View>
      )}
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: CHAT.draftFill, borderRadius: 16, padding: 14, gap: 12, alignSelf: 'stretch' },
  frameDraft: { borderWidth: DRAFT_BORDER_WIDTH, borderColor: CHAT.draftBorder, borderStyle: 'dashed' },
  frameSaved: { borderWidth: 1, borderColor: CHAT.draftBorder, borderStyle: 'solid' },
  summary: { gap: 10 },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderColor: CHAT.draftBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { ...MonoText.label, color: MonoColors.text, letterSpacing: 0.88 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  status: { ...MonoText.caption, color: MonoColors.textMeta },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { ...MonoText.titleM, color: MonoColors.text, flexShrink: 1 },
  amount: { ...MonoText.figureS },
  rows: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  rowLabel: { ...MonoText.bodyS, color: MonoColors.textMeta, flexShrink: 1 },
  rowValue: { ...MonoText.bodyS, color: MonoColors.text, textAlign: 'right', flexShrink: 1 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexGrow: 1 },
  actions: { gap: 8 },
  buttons: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...MonoText.bodyStrong, color: MonoColors.textSecond, textDecorationLine: 'underline' },
  list: { gap: 4 },
  item: { gap: 8 },
  itemRow: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  rowText: { flex: 1, gap: 2 },
  itemTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  itemSub: { ...MonoText.bodyS, color: MonoColors.textMeta },
  itemAmount: { ...MonoText.figureRow },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  lockedText: { ...MonoText.bodyS, color: MonoColors.text },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: CHECKBOX_RADIUS,
    borderWidth: 1.5,
    borderColor: CHAT.draftBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  checkboxLocked: { borderColor: MonoColors.textDisabled, opacity: 0.7 },
  totals: { gap: 6, borderTopWidth: 1, borderTopColor: CHAT.assistantBorder, paddingTop: 10 },
});
