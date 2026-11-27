// The one registry for account-logo keys stored in accounts.icon. The artwork is BRAND_ART (generated from
// assets/bank-logos and idn-finlogos); it is rendered by AccountLogo rather than copied into individual screens.
import { BANK_CARDS } from '@/components/BankCard/bankCards';

export interface AccountLogoOption {
  key: string;
  slug: string; // compatibility with the form's existing option rendering
  name: string;
}

// Keep the database value as its canonical slug so old accounts continue to work.
export const ACCOUNT_LOGOS: Record<string, AccountLogoOption> = Object.fromEntries(
  Object.entries(BANK_CARDS).map(([key, value]) => [key, { key, slug: key, name: value.name }]),
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

// What an account name may say, longest first, so "Blu BCA" is not read as BCA and "Cash App" not as cash. A word has to
// stand on its own: "saving" is not ING and "pendanaan" is not DANA.
const NEEDLES: { pattern: RegExp; key: string }[] = [
  ...Object.entries(BANK_CARDS).flatMap(([key, value]) => [key.replaceAll('-', ' '), key, value.name.toLowerCase()].map(needle => ({ needle, key }))),
  { needle: 'shopeepay', key: 'shopee-pay' },
  { needle: 'bofa', key: 'bank-of-america' },
  { needle: 'cashapp', key: 'cash-app' },
  { needle: 'cash', key: 'cash' },
  { needle: 'tunai', key: 'cash' },
]
  .sort((a, b) => b.needle.length - a.needle.length)
  .map(({ needle, key }) => ({ pattern: new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`), key }));

/** A conservative, case-insensitive convenience suggestion for a *new* account only. */
export function guessAccountLogo(name: string, type?: string): string | null {
  if (type === 'forex') return null;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return NEEDLES.find(({ pattern }) => pattern.test(normalized))?.key ?? null;
}

export function accountLogoOptionsForType(type: string): AccountLogoOption[] {
  if (type === 'cash' || type === 'forex') return [];
  return Object.values(ACCOUNT_LOGOS).filter(option => (BANK_CARDS[option.key].wallet === true) === (type === 'ewallet'));
}
