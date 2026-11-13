import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountField } from '@/components/AmountField';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { MonoSwitch } from '@/components/MonoSwitch';
import { nowIso, today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { listAccountsForForm } from '@/data/repo/accounts';
import { listCategories } from '@/data/repo/categories';
import { getRecurring } from '@/data/repo/recurring';
import { archiveRecurring, createRecurring, updateRecurring } from '@/domain/recurring';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import { cancelLabel, recurringAccountRequired, recurringAmount, recurringAmountRequired, recurringAmountVaries, recurringAmountVariesHint, recurringCategory, recurringClampHint, recurringDay, recurringEditTitle, recurringEndInvalid, recurringEnds, recurringFirstDue, recurringName, recurringNameHint, recurringNameRequired, recurringNewTitle, recurringNoEnd, recurringPayFrom, recurringRemind, recurringRemindHint, recurringRepeats, recurringSave, recurringStop, recurringStopBody, recurringStopTitle } from '@/i18n';

export default function RecurringEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const recurringId = id ? Number(id) : undefined; const db = useDb(); const router = useRouter(); const qc = useQueryClient();
  const existing = useQuery({ queryKey: [...queryKeys.recurring, recurringId], enabled: recurringId != null, queryFn: () => getRecurring(db, recurringId!) });
  const accounts = useQuery({ queryKey: queryKeys.accounts, queryFn: () => listAccountsForForm(db) }); const categories = useQuery({ queryKey: queryKeys.categories, queryFn: () => listCategories(db, { kind: 'expense' }) });
  if (recurringId && !existing.data) return <View style={styles.screen} />;
  return <RecurringEditForm key={recurringId ?? 'new'} recurringId={recurringId} existing={existing.data ?? null} accounts={accounts.data ?? []} categories={categories.data ?? []} db={db} router={router} qc={qc} />;
}

function RecurringEditForm({ recurringId, existing, accounts, categories, db, router, qc }: { recurringId?: number; existing: Awaited<ReturnType<typeof getRecurring>>; accounts: Awaited<ReturnType<typeof listAccountsForForm>>; categories: Awaited<ReturnType<typeof listCategories>>; db: ReturnType<typeof useDb>; router: ReturnType<typeof useRouter>; qc: ReturnType<typeof useQueryClient> }) {
  const [name, setName] = useState(existing?.name ?? ''); const [amount, setAmount] = useState(existing?.amount ?? 0); const [varies, setVaries] = useState(!!existing?.amount_varies); const [accountId, setAccountId] = useState<number | null>(existing?.account_id ?? null); const [categoryId, setCategoryId] = useState<number | null>(existing?.category_id ?? null); const [day, setDay] = useState(existing?.day_of_month ?? 1); const [firstDue, setFirstDue] = useState(existing?.first_due_on ?? today()); const [endOn, setEndOn] = useState<string | null>(existing?.end_on ?? null); const [remind, setRemind] = useState(existing ? !!existing.remind : true); const [submitted, setSubmitted] = useState(false);
  const errors = { name: !name.trim() || name.trim().length > 40 ? recurringNameRequired() : '', amount: amount <= 0 ? recurringAmountRequired() : '', account: accountId == null ? recurringAccountRequired() : '', end: endOn && endOn < firstDue ? recurringEndInvalid() : '' }; const valid = !Object.values(errors).some(Boolean);
  const save = async () => { setSubmitted(true); if (!valid || accountId == null || categoryId == null) return; const input = { name: name.trim(), amount, amountVaries: varies, accountId, categoryId, dayOfMonth: day, firstDueOn: firstDue, endOn, remind }; if (recurringId) await updateRecurring(db, recurringId, input); else await createRecurring(db, input, nowIso()); await qc.invalidateQueries(); router.back(); };
  const stop = async () => { if (!recurringId) return; await archiveRecurring(db, recurringId); await qc.invalidateQueries(); router.back(); };
  return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>{recurringId ? recurringEditTitle() : recurringNewTitle()}</Text>
    <Field label={recurringName()} value={name} onChangeText={setName} placeholder={recurringNameHint()} error={submitted ? errors.name : undefined} maxLength={40} />
    <AmountField label={recurringAmount()} value={amount} onChangeValue={setAmount} error={submitted ? errors.amount : undefined} />
    <SwitchRow label={recurringAmountVaries()} hint={recurringAmountVariesHint()} value={varies} onChange={setVaries} />
    <Text style={styles.label}>{recurringCategory()}</Text><View style={styles.chips}>{categories.map(c => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}</View>
    <Text style={styles.label}>{recurringPayFrom()}</Text>{accounts.filter(a => a.type !== 'forex').map(a => <Pressable key={a.id} onPress={() => setAccountId(a.id)} style={[styles.choice, accountId === a.id && styles.selected]}><Text style={styles.name}>{a.name}</Text><Text style={styles.sub}>Saldo Rp{a.balance.toLocaleString('id-ID')}</Text></Pressable>)}{submitted && errors.account ? <Text style={styles.error}>{errors.account}</Text> : null}
    <Text style={styles.label}>{recurringRepeats()}</Text><View style={styles.stepper}><Button label="−" variant="secondary" onPress={() => setDay(Math.max(1, day - 1))} style={styles.step}/><Text style={styles.stepText}>{recurringDay(day)}</Text><Button label="+" variant="secondary" onPress={() => setDay(Math.min(31, day + 1))} style={styles.step}/></View><Text style={styles.sub}>{recurringClampHint()}</Text>
    <Field label={recurringFirstDue()} value={firstDue} onChangeText={setFirstDue} placeholder="2026-10-28" /><Field label={recurringEnds()} value={endOn ?? ''} onChangeText={t => setEndOn(t || null)} placeholder={recurringNoEnd()} error={submitted ? errors.end : undefined} />
    <SwitchRow label={recurringRemind()} hint={recurringRemindHint()} value={remind} onChange={setRemind} />
    {recurringId && <Button label={recurringStop()} variant="secondary" onPress={() => { if (confirm(`${recurringStopTitle(name)}\n${recurringStopBody()}`)) void stop(); }} />}
  </ScrollView><View style={styles.bottom}><Button label={cancelLabel()} variant="secondary" onPress={() => router.back()} style={styles.cancel}/><Button label={recurringSave()} onPress={() => void save()} disabled={!valid} style={styles.save}/></View></View>;
}
function Chip({ label, selected, onPress }: {label:string;selected:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.selected]}><Text style={[styles.chipText, selected && styles.chipSelected]}>{label}</Text></Pressable>; }
function SwitchRow({label,hint,value,onChange}:{label:string;hint:string;value:boolean;onChange:(v:boolean)=>void}) { return <View style={styles.switchRow}><View style={styles.switchText}><Text style={styles.name}>{label}</Text><Text style={styles.sub}>{hint}</Text></View><MonoSwitch label={label} value={value} onValueChange={onChange} /></View>; }
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:MonoColors.bg},content:{padding:16,gap:14,paddingBottom:100},title:{...MonoText.titleL,color:MonoColors.text,marginBottom:4},label:{...MonoText.label,color:MonoColors.textSecond},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{minHeight:40,borderWidth:1,borderColor:MonoColors.border,borderRadius:20,justifyContent:'center',paddingHorizontal:14},selected:{borderColor:MonoColors.text,borderWidth:1.5,backgroundColor:MonoColors.raised},chipText:{...MonoText.bodyS,color:MonoColors.textSecond},chipSelected:{color:MonoColors.text},choice:{minHeight:56,padding:12,borderWidth:1,borderColor:MonoColors.border,borderRadius:radius.md,gap:2},name:{...MonoText.bodyStrong,color:MonoColors.text},sub:{...MonoText.bodyS,color:MonoColors.textMeta},error:{...MonoText.bodyS,color:MonoColors.negative},stepper:{flexDirection:'row',alignItems:'center',gap:12},step:{width:48,paddingHorizontal:0},stepText:{...MonoText.bodyStrong,color:MonoColors.text,flex:1,textAlign:'center'},switchRow:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:4},switchText:{flex:1,gap:3},bottom:{flexDirection:'row',gap:12,padding:16,borderTopWidth:1,borderTopColor:MonoColors.border,backgroundColor:MonoColors.bg},cancel:{width:104},save:{flex:1}});
