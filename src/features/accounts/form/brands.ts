// Which brand marks the account form offers for each account type and country. The brands themselves (colour,
// logo, whether it is an e-wallet) are src/components/BankCard/bankCards.ts, the countries ../countries.ts. A cash
// account has no brand (it has its own card), and an account with no brand chosen falls back to its type's neutral card.
import { BANK_CARDS } from '@/components/BankCard/bankCards';
import type { PlainAccountType } from '@/core/account/validate';

import { BANK_COUNTRIES, type BankCountry, type BankCountryId } from '../countries';

export interface BrandOption {
  slug: string;
  name: string;
}

// E-wallets for an E-wallet account, banks for Bank and Savings.
const fits = (slug: string, type: PlainAccountType) => (BANK_CARDS[slug].wallet === true) === (type === 'ewallet');

function toOption(slug: string): BrandOption {
  return { slug, name: BANK_CARDS[slug].name };
}

// The brands to offer for a type, of one country or (without one) of all of them; none for Cash.
export function brandsForType(type: PlainAccountType, country?: BankCountryId): BrandOption[] {
  if (type === 'cash') return [];
  const slugs = country ? (BANK_COUNTRIES.find(c => c.id === country)?.slugs ?? []) : Object.keys(BANK_CARDS);
  return slugs.filter(slug => fits(slug, type)).map(toOption);
}

// The countries that have something to offer for a type.
export function countriesForType(type: PlainAccountType): BankCountry[] {
  return BANK_COUNTRIES.filter(country => brandsForType(type, country.id).length > 0);
}

// A chosen brand that the new type does not offer (Bank → E-wallet) is dropped.
export function iconFitsType(icon: string | null, type: PlainAccountType): boolean {
  if (icon == null) return true;
  return brandsForType(type).some(b => b.slug === icon);
}
