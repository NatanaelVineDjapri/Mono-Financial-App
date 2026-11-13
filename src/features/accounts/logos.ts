// The one registry for account-logo keys stored in accounts.icon. The artwork comes from
// idn-finlogos; it is rendered by AccountLogo rather than copied into individual screens.
import { BANK_CARDS } from '@/components/BankCard/bankCards';

export interface AccountLogoOption {
  key: string;
  slug: string; // compatibility with the form's existing option rendering
  name: string;
}

// BANK_CARDS is the existing, verified catalogue used for account cards. Keep the database
// value as its canonical slug so old accounts continue to work.
export const ACCOUNT_LOGOS: Record<string, AccountLogoOption> = Object.fromEntries(
  Object.entries(BANK_CARDS)
    .filter(([key]) => key !== 'stockbit') // this card uses a provisional text wordmark, not logo artwork.
    .map(([key, value]) => [key, { key, slug: key, name: value.name }]),
);

// These keys are legitimate non-brand account presentations. They deliberately resolve to
// AccountLogo's neutral fallback instead of a bank/e-wallet mark.
export const ACCOUNT_LOGO_SPECIAL_KEYS = ['cash', 'valas'] as const;

export function accountLogoOption(key: string | null | undefined): AccountLogoOption | undefined {
  return key ? ACCOUNT_LOGOS[key] : undefined;
}

export function isAccountLogoKey(key: string | null | undefined): key is string {
  return !!accountLogoOption(key);
}

/** A conservative, case-insensitive convenience suggestion for a *new* account only. */
export function guessAccountLogo(name: string, type?: string): string | null {
  if (type === 'forex') return null;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const aliases: Record<string, string> = {
    'shopeepay': 'shopee-pay',
    'shopee pay': 'shopee-pay',
    'cash': 'cash',
    'tunai': 'cash',
  };
  for (const [needle, key] of Object.entries(aliases)) {
    if (normalized.includes(needle)) return key;
  }
  return Object.keys(ACCOUNT_LOGOS).find(key => normalized.includes(key.replaceAll('-', ' ')) || normalized.includes(key)) ?? null;
}

export function accountLogoOptionsForType(type: string): AccountLogoOption[] {
  if (type === 'cash' || type === 'forex') return [];
  const ewalletKeys = new Set(['gopay', 'ovo', 'dana', 'shopee-pay', 'linkaja', 'astra-pay', 'doku', 'dutamoney', 'i-saku', 'jakone-pay', 'kaspro', 'netzme', 'otto-pay', 'paytren', 'pospay', 'speedcash', 'truemoney', 'uangku', 'yukk']);
  return Object.values(ACCOUNT_LOGOS).filter(option => type === 'ewallet' ? ewalletKeys.has(option.key) : !ewalletKeys.has(option.key));
}
