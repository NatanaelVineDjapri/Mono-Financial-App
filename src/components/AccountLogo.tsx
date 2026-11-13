import { Logo } from 'idn-finlogos/react-native';
import { StyleSheet, View } from 'react-native';

import { NEUTRAL_GLYPHS } from '@/components/BankCard/cardAssets';
import type { AccountType } from '@/data/repo/accounts';
import { accountLogoOption } from '@/features/accounts/logos';

/**
 * Shared small account mark. Brand/e-wallet logos retain their native artwork on a white
 * tile; unknown, empty and non-brand keys use a neutral type glyph. Account names convey
 * the same information, so the tile stays decorative for assistive technology.
 */
export function accountLogoPresentation(iconKey: string | null | undefined, type: AccountType): 'brand' | 'fallback' {
  return type !== 'forex' && accountLogoOption(iconKey) ? 'brand' : 'fallback';
}

export function AccountLogo({ iconKey, type, size = 36, testID }: { accountId?: number; iconKey?: string | null; type: AccountType; size?: number; testID?: string }) {
  const logo = accountLogoPresentation(iconKey, type) === 'brand' ? accountLogoOption(iconKey) : undefined;
  const glyphKey = type === 'cash' ? 'cash' : type === 'forex' ? 'valas' : 'default';
  const markSize = Math.max(12, size - 10);
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size / 3) }, logo ? styles.brandTile : styles.fallbackTile]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {logo ? (
        <Logo slug={logo.key} width={markSize} height={markSize} preserveAspectRatio="xMidYMid meet" testID={`${testID ?? 'account-logo'}-brand`} />
      ) : (
        <Logo svg={NEUTRAL_GLYPHS[glyphKey]} width={markSize} height={markSize} color="#F5F5F5" testID={`${testID ?? 'account-logo'}-fallback`} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandTile: { backgroundColor: '#F5F5F5' },
  fallbackTile: { backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B' },
});
