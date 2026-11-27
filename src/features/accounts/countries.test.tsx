import { BANK_CARDS } from '@/components/BankCard/bankCards';
import { BRAND_ART, BRAND_LOGOS } from '@/components/BankCard/cardAssets';

import { BANK_COUNTRIES } from './countries';
import { brandsForType, countriesForType } from './form/brands';

describe('bank countries', () => {
  test('every brand is offered somewhere, and every offered one exists with its artwork', () => {
    const offered = new Set(BANK_COUNTRIES.flatMap(c => c.slugs));
    expect([...offered].filter(slug => !BANK_CARDS[slug])).toEqual([]);
    expect(Object.keys(BANK_CARDS).filter(slug => !offered.has(slug))).toEqual([]);
    for (const [slug, brand] of Object.entries(BANK_CARDS)) {
      expect(BRAND_ART[slug]).toContain('viewBox');
      // react-native-svg draws no CSS: a <style> or class= would come out black
      expect(BRAND_ART[slug]).not.toMatch(/<style|class=|<image|<script/);
      if (!brand.plate) expect(BRAND_LOGOS[slug]).toBeDefined();
    }
  });

  test('banks and e-wallets are kept apart; a country without one is left out', () => {
    expect(brandsForType('bank', 'id').map(b => b.slug)).toEqual(expect.arrayContaining(['bca', 'krom']));
    expect(brandsForType('bank', 'id').map(b => b.slug)).not.toContain('chase');
    expect(brandsForType('ewallet', 'id').map(b => b.slug)).toEqual(expect.arrayContaining(['gopay', 'stockbit']));
    expect(brandsForType('savings', 'cn').map(b => b.slug)).toEqual(['icbc', 'ccb', 'bank-of-china', 'bank-of-communications']);
    expect(countriesForType('ewallet').map(c => c.id)).not.toContain('kr');
    expect(brandsForType('cash', 'id')).toEqual([]);
  });
});
