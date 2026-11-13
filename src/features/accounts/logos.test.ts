import { accountLogoOption, guessAccountLogo } from './logos';

describe('account logo registry', () => {
  it('returns no logo for unknown keys', () => {
    expect(accountLogoOption('not-a-logo')).toBeUndefined();
  });

  it('guesses known names regardless of casing', () => {
    expect(guessAccountLogo('BCA Tabungan')).toBe('bca');
    expect(guessAccountLogo('GoPay utama')).toBe('gopay');
    expect(guessAccountLogo('Dompet TUNAI')).toBe('cash');
  });
});
