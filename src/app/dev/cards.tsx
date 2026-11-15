// Dev-only screen to preview authentic physical cards for ALL Indonesian banks, e-wallets, and accounts.
// Guarded by __DEV__ so unreachable in production builds.
import { Redirect } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PhysicalCard,
  PHYSICAL_CARD_THEMES,
} from '@/components/PhysicalCard';
import { MonoSwitch } from '@/components/MonoSwitch';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import type { AccountType } from '@/data/repo/accounts';

type CategoryFilter = 'all' | 'bank' | 'ewallet' | 'other';

const EWALLET_SLUGS = new Set([
  'gopay',
  'ovo',
  'dana',
  'shopee-pay',
  'linkaja',
  'astra-pay',
  'doku',
  'dutamoney',
  'i-saku',
  'jakone-pay',
  'kaspro',
  'netzme',
  'otto-pay',
  'paytren',
  'pospay',
  'speedcash',
  'truemoney',
  'uangku',
  'yukk',
]);

const OTHER_SLUGS = new Set(['cash', 'valas', 'default', 'stockbit']);

function resolveAccountType(slug: string): AccountType {
  if (slug === 'cash') return 'cash';
  if (slug === 'valas') return 'forex';
  if (EWALLET_SLUGS.has(slug)) return 'ewallet';
  return 'bank';
}

function resolveSampleBalance(slug: string, index: number): number {
  if (slug === 'cash') return 1850000;
  if (slug === 'valas') return 42800000;
  if (EWALLET_SLUGS.has(slug)) return (index * 250000 + 450000) % 2000000;
  return ((index + 3) * 3750000) % 85000000 + 2500000;
}

interface PreviewEntry {
  slug: string;
  theme: (typeof PHYSICAL_CARD_THEMES)[string];
  category: CategoryFilter;
  type: AccountType;
  balance: number;
  subline: string | undefined;
  cardNumber?: string;
  holder?: string;
  expiry?: string;
}

const PreviewRow = React.memo(function PreviewRow({ item, showStrips }: { item: PreviewEntry; showStrips: boolean }) {
  return (
    <View style={styles.cardWrapper}>
      <View style={styles.cardLabelRow}>
        <View style={styles.cardTitleBox}>
          <Text style={styles.cardBankLabel}>{item.theme.name}</Text>
          <Text style={styles.cardSlugLabel}>({item.slug})</Text>
        </View>
      </View>

      <PhysicalCard
        name={item.theme.name}
        type={item.type}
        icon={item.slug}
        balance={item.balance}
        subline={item.subline}
        cardNumber={item.cardNumber}
        cardholderName={item.holder}
        expiryDate={item.expiry}
        variant={showStrips ? 'strip' : 'list'}
        onPress={noop}
        testID={`preview-${item.slug}`}
      />
    </View>
  );
});

const noop = () => {};

export default function DevPhysicalCards() {
  if (!__DEV__) return <Redirect href="/" />;
  return <PhysicalCardsContent />;
}

function PhysicalCardsContent() {
  const insets = useSafeAreaInsets();
  const [showStrips, setShowStrips] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allEntries = useMemo(() => {
    return Object.entries(PHYSICAL_CARD_THEMES).map(([slug, theme], index) => {
      const isEwallet = EWALLET_SLUGS.has(slug);
      const isOther = OTHER_SLUGS.has(slug);
      const category: CategoryFilter = isEwallet
        ? 'ewallet'
        : isOther
        ? 'other'
        : 'bank';

      return {
        slug,
        theme,
        category,
        type: resolveAccountType(slug),
        balance: resolveSampleBalance(slug, index),
        subline: slug === 'valas' ? 'US$1,850 · S$920 · €640' : undefined,
        cardNumber: undefined,
        holder: undefined,
        expiry: undefined,
      };
    });
  }, []);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEntries.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (q) {
        return (
          item.theme.name.toLowerCase().includes(q) ||
          item.slug.toLowerCase().includes(q) ||
          item.theme.cardTier.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allEntries, activeCategory, searchQuery]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Physical Cards ({allEntries.length})</Text>
        <Text style={styles.headerSubtitle}>
          All Indonesian banks, e-wallets, RDN, cash, and forex accounts
        </Text>

        {/* Search input */}
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search bank or wallet..."
          placeholderTextColor={MonoColors.textDisabled}
          style={styles.searchInput}
        />

        {/* Category Tabs */}
        <View style={styles.tabsRow}>
          {(
            [
              { id: 'all', label: `All (${allEntries.length})` },
              { id: 'bank', label: 'Banks (31)' },
              { id: 'ewallet', label: 'E-Wallets (19)' },
              { id: 'other', label: 'Others (4)' },
            ] as const
          ).map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveCategory(tab.id)}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Toggle View Mode */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show Strip mode (stacked cards)</Text>
          <MonoSwitch
            value={showStrips}
            onValueChange={setShowStrips}
            label="Show strip mode"
          />
        </View>
      </View>

      {/* Virtualized: 54 cards with four SVG roots each must not all be mounted at once. */}
      <FlatList
        data={filteredEntries}
        keyExtractor={item => item.slug}
        renderItem={({ item }) => <PreviewRow item={item} showStrips={showStrips} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No cards found matching your search.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MonoColors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: MonoColors.border,
    gap: 8,
  },
  headerTitle: {
    ...MonoText.titleL,
    color: MonoColors.text,
  },
  headerSubtitle: {
    ...MonoText.bodyS,
    color: MonoColors.textSecond,
  },
  searchInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    paddingHorizontal: 12,
    color: MonoColors.text,
    fontSize: 14,
    fontFamily: MonoText.body.fontFamily,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  tabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: MonoColors.card,
    borderWidth: 1,
    borderColor: MonoColors.border,
  },
  tabPillActive: {
    backgroundColor: MonoColors.text,
    borderColor: MonoColors.text,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: MonoColors.textSecond,
  },
  tabTextActive: {
    color: MonoColors.bg,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  toggleLabel: {
    ...MonoText.bodyS,
    color: MonoColors.text,
  },
  scrollContent: {
    padding: 20,
    gap: 22,
  },
  cardWrapper: {
    gap: 8,
  },
  cardLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  cardTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardBankLabel: {
    ...MonoText.h2,
    color: MonoColors.text,
  },
  cardSlugLabel: {
    ...MonoText.caption,
    color: MonoColors.textDisabled,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    ...MonoText.body,
    color: MonoColors.textSecond,
  },
});
