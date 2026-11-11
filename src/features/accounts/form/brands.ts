// Which brand marks the account form offers for each account type. The brands themselves (colour,
// logo) are src/components/BankCard/bankCards.ts; this only splits that one list into banks and
// e-wallets, since the table does not say which is which. A cash account has no brand (it has
// its own card), and an account with no brand chosen falls back to its type's neutral card.
import { BANK_CARDS } from '@/components/BankCard';
import type { PlainAccountType } from '@/core/account/validate';

const EWALLET_SLUGS = [
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
  'stockbit',
] as const;

const EWALLETS = new Set<string>(EWALLET_SLUGS);

export interface BrandOption {
  slug: string;
  name: string;
}

function toOption(slug: string): BrandOption {
  return { slug, name: BANK_CARDS[slug].name };
}

// The brands to offer for a type: banks for Bank and Savings, e-wallets for E-wallet, none for Cash.
export function brandsForType(type: PlainAccountType): BrandOption[] {
  if (type === 'cash') return [];
  const slugs = Object.keys(BANK_CARDS);
  const wanted = type === 'ewallet' ? slugs.filter(s => EWALLETS.has(s)) : slugs.filter(s => !EWALLETS.has(s));
  return wanted.map(toOption);
}

// A chosen brand that the new type does not offer (Bank → E-wallet) is dropped.
export function iconFitsType(icon: string | null, type: PlainAccountType): boolean {
  if (icon == null) return true;
  return brandsForType(type).some(b => b.slug === icon);
}
