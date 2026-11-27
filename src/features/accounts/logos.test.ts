import { accountLogoOption, guessAccountLogo } from './logos';

describe('account logo registry', () => {
  it('returns no logo for unknown keys', () => {
    expect(accountLogoOption('not-a-logo')).toBeUndefined();
  });

  it('guesses known names regardless of casing', () => {
    expect(guessAccountLogo('BCA Tabungan')).toBe('bca');
    expect(guessAccountLogo('GoPay utama')).toBe('gopay');
    expect(guessAccountLogo('Dompet TUNAI')).toBe('cash');
    expect(guessAccountLogo('Blu BCA')).toBe('blu-bca');
    expect(guessAccountLogo('Cash App')).toBe('cash-app');
    expect(guessAccountLogo('Bank of America checking')).toBe('bank-of-america');
    expect(guessAccountLogo('ShopeePay')).toBe('shopee-pay');
    expect(guessAccountLogo('RDN Stockbit')).toBe('stockbit');
  });

  it('does not read a brand out of the middle of a word', () => {
    expect(guessAccountLogo('Saving')).toBeNull();
    expect(guessAccountLogo('Pendanaan usaha')).toBeNull();
  });
});
