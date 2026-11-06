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
import { Fab } from '@/components/Fab';
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
          <Text style={styles.controlLabel}>Skala teks 200% (simulasi)</Text>
          <MonoSwitch value={scale200} onValueChange={setScale200} label="Skala teks 200%, simulasi" />
        </View>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Sembunyikan nominal</Text>
          <MonoSwitch value={hidden} onValueChange={toggleHidden} label="Sembunyikan nominal" />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 24 }}>
        <View style={scale200 ? styles.scaled : undefined}>
          <Section title="Button">
            <Row label="primary: default / disabled / loading">
              <Button label="Simpan" onPress={() => {}} />
              <Button label="Simpan" onPress={() => {}} disabled />
              <Button label="Simpan" onPress={() => {}} loading />
            </Row>
            <Row label="secondary: default / disabled">
              <Button label="Batal" variant="secondary" onPress={() => {}} />
              <Button label="Batal" variant="secondary" onPress={() => {}} disabled />
            </Row>
          </Section>

          <Section title="IconButton">
            <Row label="default / disabled">
              <IconButton label="Tambah">
                <Icon name="plus" color={MonoColors.text} />
              </IconButton>
              <IconButton label="Tambah" disabled>
                <Icon name="plus" color={MonoColors.textDisabled} />
              </IconButton>
            </Row>
          </Section>

          <Section title="Fab">
            <Row label="default / disabled">
              <Fab label="Catat transaksi" onPress={() => {}}>
                <Icon name="plus" color={MonoColors.bg} />
              </Fab>
              <Fab label="Catat transaksi" onPress={() => {}} disabled>
                <Icon name="plus" color={MonoColors.bg} />
              </Fab>
            </Row>
          </Section>

          <Section title="Chip">
            <Row label="unselected / selected / disabled">
              <Chip label="Makanan" selected={false} onPress={() => {}} />
              <Chip label="Makanan" selected onPress={() => {}} />
              <Chip label="Makanan" selected={false} onPress={() => {}} disabled />
            </Row>
          </Section>

          <Section title="Segmented">
            <Row label="terpilih (ketuk buat ganti) / disabled">
              <Segmented
                options={[
                  { value: 'expense', label: 'Pengeluaran' },
                  { value: 'income', label: 'Pemasukan' },
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
            <Row label="default (ketuk buat lihat fokus)">
              <Field label="Nama akun" placeholder="BCA Tabungan" />
            </Row>
            <Row label="error">
              <Field label="Nama akun" placeholder="BCA Tabungan" error="Nama akun wajib diisi." />
            </Row>
            <Row label="disabled">
              <Field label="Nama akun" value="BCA Tabungan" disabled />
            </Row>
          </Section>

          <Section title="AmountField">
            <Row label="default (ketuk buat lihat fokus)">
              <AmountField label="Jumlah" value={amount} onChangeValue={setAmount} />
            </Row>
            <Row label="error">
              <AmountField label="Jumlah" value={amountWithError} onChangeValue={setAmountWithError} error="Masukkan jumlah di atas Rp0." />
            </Row>
            <Row label="disabled">
              <AmountField label="Jumlah" value={200000} onChangeValue={() => {}} disabled />
            </Row>
          </Section>

          <Section title="Sheet">
            <Row label="tombol buka">
              <Button label="Buka Sheet" onPress={() => setSheetVisible(true)} />
            </Row>
          </Section>

          <Section title="Toast">
            <Row label="tombol tampilkan, dengan Undo">
              <Button label="Tampilkan Toast" onPress={() => setToastVisible(true)} />
            </Row>
          </Section>

          <Section title="MonoSwitch">
            <Row label="on / off / disabled">
              <MonoSwitch value={switchOn} onValueChange={setSwitchOn} label="Contoh switch" />
              <MonoSwitch value={false} onValueChange={() => {}} label="Contoh switch" />
              <MonoSwitch value={true} onValueChange={() => {}} label="Contoh switch" disabled />
            </Row>
          </Section>

          <Section title="ProgressBar">
            <Row label="0% / 50% / 100%">
              <View style={{ gap: 12, flex: 1 }}>
                <ProgressBar valueBp={0} label="Kosong" />
                <ProgressBar valueBp={5000} label="Setengah" />
                <ProgressBar valueBp={10000} label="Penuh" />
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
                { label: 'Pemasukan', kind: 'income' },
                { label: 'Pengeluaran', kind: 'expense' },
              ]}
              rows={[
                { label: 'Mei', values: [6800000, 6800000] },
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

          <Section title="BankCard — lebar (bug: latar lebih kecil dari wadah di layar lebar penuh)">
            <View style={{ gap: 16 }}>
              <Text style={styles.rowLabel}>Carousel (312, tetap)</Text>
              <BankCard name="BCA Tabungan" type="bank" icon="bca" balance={6842500} onPress={() => {}} variant="carousel" testID="card-312" />
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

          <Section title="BankCard — kartu netral">
            <View style={{ gap: 12 }}>
              {Object.keys(NEUTRAL_CARDS).map(slug => (
                <BankCard
                  key={slug}
                  name={slug === 'cash' ? 'Cash wallet' : slug === 'valas' ? 'Valas' : 'Akun tanpa bank'}
                  type={slug === 'cash' ? 'cash' : slug === 'valas' ? 'forex' : 'ewallet'}
                  icon={null}
                  balance={450000}
                  onPress={() => {}}
                />
              ))}
            </View>
          </Section>

          <Section title="BankCard — semua slug bank/e-wallet">
            <View style={{ gap: 12 }}>
              {Object.entries(BANK_CARDS).map(([slug, card]) => (
                <BankCard key={slug} name={card.name} type="bank" icon={slug} balance={1234500} onPress={() => {}} />
              ))}
            </View>
          </Section>
        </View>
      </ScrollView>

      <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)} closeLabel="Tutup">
        <Text style={styles.sheetTitle}>Contoh Sheet</Text>
        <Text style={styles.sheetBody}>Ini isi contoh di dalam Sheet, buat lihat scrim dan animasinya.</Text>
      </Sheet>

      <Toast
        visible={toastVisible}
        message="Contoh toast ditampilkan."
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
