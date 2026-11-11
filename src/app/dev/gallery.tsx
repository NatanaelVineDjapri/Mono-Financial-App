// Dev-only component gallery (Phase 3): every component from Button through BankCard,
// in their states, so a screenshot can be compared against the DS boards. Guarded by
// __DEV__ so the route is unreachable in a production build — expo-router still bundles
// the file (file-based routing has no build-time exclusion for a single route), but it
// renders nothing but a redirect once __DEV__ is false, which is what "cannot be opened
// in production" means in practice for a single dev route like this.
import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { AmountField } from '@/components/AmountField';
import { BankCard } from '@/components/BankCard';
import { BANK_CARDS, NEUTRAL_CARDS } from '@/components/BankCard/bankCards';
import { Button } from '@/components/Button';
import { ChartTable } from '@/components/ChartTable';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MonoSwitch } from '@/components/MonoSwitch';
import { ProgressBar } from '@/components/ProgressBar';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Toast } from '@/components/Toast';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowContent}>{children}</View>
    </View>
  );
}

export default function Gallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <GalleryContent />;
}

function GalleryContent() {
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(s => s.hidden);
  const toggleHidden = useHideAmounts(s => s.toggle);
  const [scale200, setScale200] = useState(false);
  const [segmentValue, setSegmentValue] = useState('income');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [amount, setAmount] = useState(1500000);
  const [amountWithError, setAmountWithError] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: MonoColors.bg }}>
      <View style={[styles.controlBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.controlBarTitle}>Dev gallery</Text>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Text scale 200% (simulated)</Text>
          <MonoSwitch value={scale200} onValueChange={setScale200} label="Text scale 200%, simulated" />
        </View>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Hide amounts</Text>
          <MonoSwitch value={hidden} onValueChange={toggleHidden} label="Hide amounts" />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 24 }}>
        <View style={scale200 ? styles.scaled : undefined}>
          <Section title="Button">
            <Row label="primary: default / disabled / loading">
              <Button label="Save" onPress={() => {}} />
              <Button label="Save" onPress={() => {}} disabled />
              <Button label="Save" onPress={() => {}} loading />
            </Row>
            <Row label="secondary: default / disabled">
              <Button label="Cancel" variant="secondary" onPress={() => {}} />
              <Button label="Cancel" variant="secondary" onPress={() => {}} disabled />
            </Row>
          </Section>

          <Section title="IconButton">
            <Row label="default / disabled">
              <IconButton label="Add">
                <Icon name="plus" color={MonoColors.text} />
              </IconButton>
              <IconButton label="Add" disabled>
                <Icon name="plus" color={MonoColors.textDisabled} />
              </IconButton>
            </Row>
          </Section>

          <Section title="Chip">
            <Row label="unselected / selected / disabled">
              <Chip label="Food" selected={false} onPress={() => {}} />
              <Chip label="Food" selected onPress={() => {}} />
              <Chip label="Food" selected={false} onPress={() => {}} disabled />
            </Row>
          </Section>

          <Section title="Segmented">
            <Row label="selected (tap to change) / disabled">
              <Segmented
                options={[
                  { value: 'expense', label: 'Expense' },
                  { value: 'income', label: 'Income' },
                  { value: 'transfer', label: 'Transfer' },
                ]}
                value={segmentValue}
                onChange={setSegmentValue}
              />
              <Segmented
                options={[
                  { value: 'a', label: 'A' },
                  { value: 'b', label: 'B' },
                ]}
                value="a"
                onChange={() => {}}
                disabled
              />
            </Row>
          </Section>

          <Section title="Field">
            <Row label="default (tap to see focus)">
              <Field label="Account name" placeholder="BCA Tabungan" />
            </Row>
            <Row label="error">
              <Field label="Account name" placeholder="BCA Tabungan" error="Account name is required." />
            </Row>
            <Row label="disabled">
              <Field label="Account name" value="BCA Tabungan" disabled />
            </Row>
          </Section>

          <Section title="AmountField">
            <Row label="default (tap to see focus)">
              <AmountField label="Amount" value={amount} onChangeValue={setAmount} />
            </Row>
            <Row label="error">
              <AmountField label="Amount" value={amountWithError} onChangeValue={setAmountWithError} error="Enter an amount above Rp0." />
            </Row>
            <Row label="disabled">
              <AmountField label="Amount" value={200000} onChangeValue={() => {}} disabled />
            </Row>
          </Section>

          <Section title="Sheet">
            <Row label="open button">
              <Button label="Open Sheet" onPress={() => setSheetVisible(true)} />
            </Row>
          </Section>

          <Section title="Toast">
            <Row label="show button, with Undo">
              <Button label="Show Toast" onPress={() => setToastVisible(true)} />
            </Row>
          </Section>

          <Section title="MonoSwitch">
            <Row label="on / off / disabled">
              <MonoSwitch value={switchOn} onValueChange={setSwitchOn} label="Example switch" />
              <MonoSwitch value={false} onValueChange={() => {}} label="Example switch" />
              <MonoSwitch value={true} onValueChange={() => {}} label="Example switch" disabled />
            </Row>
          </Section>

          <Section title="ProgressBar">
            <Row label="0% / 50% / 100%">
              <View style={{ gap: 12, flex: 1 }}>
                <ProgressBar valueBp={0} label="Empty" />
                <ProgressBar valueBp={5000} label="Half" />
                <ProgressBar valueBp={10000} label="Full" />
              </View>
            </Row>
            <Row label="over-limit (116%)">
              <View style={{ flex: 1 }}>
                <ProgressBar valueBp={11600} label="Shopping" overAmount={112000} />
              </View>
            </Row>
          </Section>

          <Section title="ChartTable">
            <ChartTable
              columns={[
                { label: 'Income', kind: 'income' },
                { label: 'Expense', kind: 'expense' },
              ]}
              rows={[
                { label: 'May', values: [6800000, 6800000] },
                { label: 'Jun', values: [7000000, 6600000] },
              ]}
              totalRow={{ label: 'Total', values: [13800000, 13400000] }}
            />
          </Section>

          <Section title="Amount">
            <Row label="income / expense / transfer">
              <Amount value={7500000} kind="income" sign />
              <Amount value={-38500} kind="expense" />
              <Amount value={1000000} kind="transfer" />
            </Row>
          </Section>

          <Section title="BankCard — width (bug: the background is smaller than its container on a full-width screen)">
            <View style={{ gap: 16 }}>
              <Text style={styles.rowLabel}>Carousel (312, tetap)</Text>
              <BankCard name="BCA Tabungan" type="bank" icon="bca" balance={6842500} onPress={() => {}} variant="carousel" testID="card-300" />
              <Text style={styles.rowLabel}>List, lebar penuh (width 100%)</Text>
              <BankCard name="BCA Tabungan" type="bank" icon="bca" balance={6842500} onPress={() => {}} variant="list" testID="card-full" />
              <Text style={styles.rowLabel}>List, wadah sempit 360dp</Text>
              <View style={{ width: 360 }}>
                <BankCard name="BCA Tabungan" type="bank" icon="bca" balance={6842500} onPress={() => {}} variant="list" testID="card-360" />
              </View>
            </View>
          </Section>

          <Section title="BankCard — Valas">
            <BankCard
              name="Valas"
              type="forex"
              icon={null}
              balance={6312500}
              subline="US$250,00 · S$180,00"
              onPress={() => {}}
            />
          </Section>

          <Section title="BankCard — neutral cards">
            <View style={{ gap: 12 }}>
              {Object.keys(NEUTRAL_CARDS).map(slug => (
                <BankCard
                  key={slug}
                  name={slug === 'cash' ? 'Cash wallet' : slug === 'valas' ? 'Valas' : 'Account without a bank'}
                  type={slug === 'cash' ? 'cash' : slug === 'valas' ? 'forex' : 'ewallet'}
                  icon={null}
                  balance={450000}
                  onPress={() => {}}
                />
              ))}
            </View>
          </Section>

          <Section title="BankCard — every bank/e-wallet slug">
            <View style={{ gap: 12 }}>
              {Object.entries(BANK_CARDS).map(([slug, card]) => (
                <BankCard key={slug} name={card.name} type="bank" icon={slug} balance={1234500} onPress={() => {}} />
              ))}
            </View>
          </Section>
        </View>
      </ScrollView>

      <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)} closeLabel="Close">
        <Text style={styles.sheetTitle}>Example Sheet</Text>
        <Text style={styles.sheetBody}>This is example content inside the Sheet, to see the scrim and its animation.</Text>
      </Sheet>

      <Toast
        visible={toastVisible}
        message="Example toast shown."
        actionLabel="Urungkan"
        onAction={() => {}}
        onDismiss={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controlBar: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: MonoColors.surface, borderBottomWidth: 1, borderBottomColor: MonoColors.border, gap: 8 },
  controlBarTitle: { ...MonoText.titleM, color: MonoColors.text },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlLabel: { ...MonoText.body, color: MonoColors.textSecond },
  // Centre-anchored (RN's transform has no transformOrigin in this version) — a rough
  // visual simulation, not real OS text scaling, which only grows text, not layout.
  scaled: { transform: [{ scale: 2 }] },
  section: { gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  sectionTitle: { ...MonoText.h2, color: MonoColors.text },
  row: { gap: 8 },
  rowLabel: { ...MonoText.caption, color: MonoColors.textMeta },
  rowContent: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  sheetTitle: { ...MonoText.titleM, color: MonoColors.text, marginBottom: 8 },
  sheetBody: { ...MonoText.body, color: MonoColors.textSecond },
});
