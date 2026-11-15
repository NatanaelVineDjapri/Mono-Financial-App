import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Card } from '@/components/Card';
import { HeaderRow } from '@/components/HeaderRow';
import { Icon, type IconName } from '@/components/Icon';
import { tabLabel } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const INSIGHTS: { icon: IconName; title: string; body: string; badge: string }[] = [
  { icon: 'food', title: 'Makan dan minum', body: 'Pengeluaran terbesar kamu bulan ini', badge: '32%' },
  { icon: 'wallet', title: 'Kebiasaan belanja', body: '20% lebih rendah dari bulan lalu', badge: '−20%' },
  { icon: 'savings', title: 'Tetap di jalur', body: '8% di bawah anggaran bulanan', badge: '+8%' },
];

function HealthScore() {
  return (
    <View style={styles.scoreWrap}>
      <Svg width={128} height={128} viewBox="0 0 128 128">
        <Circle cx="64" cy="64" r="51" fill="none" stroke={MonoColors.border} strokeWidth="10" />
        <Circle
          cx="64"
          cy="64"
          r="51"
          fill="none"
          stroke={MonoColors.accent}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="245 320"
          rotation="-42"
          origin="64, 64"
        />
      </Svg>
      <View style={styles.scoreText}>
        <Text style={styles.score}>86</Text>
        <Text style={styles.scoreOf}>/ 100</Text>
      </View>
    </View>
  );
}

function InsightRow({ icon, title, body, badge, last }: (typeof INSIGHTS)[number] & { last: boolean }) {
  return (
    <Pressable style={[styles.insightRow, !last && styles.divider]} accessibilityRole="button">
      <View style={styles.insightIcon}>
        <Icon name={icon} size={20} color={MonoColors.textSecond} />
      </View>
      <View style={styles.insightCopy}>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightBody}>{body}</Text>
      </View>
      <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
      <Icon name="chevron-right" size={18} color={MonoColors.textMeta} />
    </Pressable>
  );
}

export default function AnalyzeScreen() {
  return (
    <View style={styles.screen}>
      <HeaderRow title={tabLabel('analyze')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Ringkasan kebiasaan dan pola keuanganmu.</Text>

        <Card style={styles.healthCard}>
          <HealthScore />
          <View style={styles.healthCopy}>
            <Text style={styles.cardTitle}>Kesehatan Keuanganmu</Text>
            <Text style={styles.body}>Kamu menabung dengan bijak dan menjaga pengeluaran tetap terkendali.</Text>
            <View style={styles.healthMeta}>
              <Text style={styles.excellent}>Sangat baik</Text>
              <Text style={styles.change}>+5 dari bulan lalu</Text>
            </View>
          </View>
        </Card>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}><Icon name="spark" size={20} color={MonoColors.accent} /><Text style={styles.sectionTitle}>Analisis AI</Text></View>
          <Pressable style={styles.details} accessibilityRole="button"><Text style={styles.detailsText}>Lihat detail</Text><Icon name="chevron-right" size={16} color={MonoColors.textSecond} /></Pressable>
        </View>

        <Card style={styles.aiCard}>
          <View style={styles.aiIcon}><Icon name="chat" size={28} color={MonoColors.textSecond} /></View>
          <Text style={styles.aiText}>Pengeluaranmu 12% lebih rendah dari bulan lalu, terutama karena belanja makan dan minuman berkurang.</Text>
        </Card>

        <Text style={styles.sectionTitle}>Wawasan utama</Text>
        <Card style={styles.insightsCard}>
          {INSIGHTS.map((item, index) => <InsightRow key={item.title} {...item} last={index === INSIGHTS.length - 1} />)}
        </Card>

        <Pressable style={styles.tip} accessibilityRole="button">
          <View style={styles.tipIcon}><Icon name="spark" size={22} color={MonoColors.accent} /></View>
          <Text style={styles.tipText}>Coba kurangi pengeluaran makan di luar bulan ini. Kamu bisa menghemat hingga Rp300.000.</Text>
          <Icon name="chevron-right" size={18} color={MonoColors.textSecond} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  intro: { ...MonoText.bodyS, color: MonoColors.textMeta, marginTop: -8 },
  healthCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  scoreText: { position: 'absolute', alignItems: 'center' },
  score: { ...MonoText.figureXL, color: MonoColors.text },
  scoreOf: { ...MonoText.caption, color: MonoColors.textMeta },
  healthCopy: { flex: 1, gap: 8 },
  cardTitle: { ...MonoText.titleM, color: MonoColors.text },
  body: { ...MonoText.bodyS, color: MonoColors.textSecond },
  healthMeta: { gap: 8 },
  excellent: { ...MonoText.caption, color: MonoColors.text, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  change: { ...MonoText.caption, color: MonoColors.textSecond },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { ...MonoText.titleM, color: MonoColors.text },
  details: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 14, paddingHorizontal: 10, minHeight: 44 },
  detailsText: { ...MonoText.caption, color: MonoColors.textSecond },
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: MonoColors.raised },
  aiIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: MonoColors.card, alignItems: 'center', justifyContent: 'center' },
  aiText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
  insightsCard: { gap: 0, paddingVertical: 4 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 60 },
  divider: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  insightIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: MonoColors.raised, alignItems: 'center', justifyContent: 'center' },
  insightCopy: { flex: 1, gap: 2 },
  insightTitle: { ...MonoText.bodyS, color: MonoColors.text },
  insightBody: { ...MonoText.caption, color: MonoColors.textMeta },
  badge: { borderWidth: 1, borderColor: MonoColors.border, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { ...MonoText.caption, color: MonoColors.textSecond },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: MonoColors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: MonoColors.border, padding: 14 },
  tipIcon: { width: 32, alignItems: 'center' },
  tipText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
});
