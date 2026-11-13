import { accountLogoPresentation } from '../AccountLogo';

describe('AccountLogo', () => {
  it('uses the brand presentation for registered logo keys', () => {
    expect(accountLogoPresentation('bca', 'bank')).toBe('brand');
  });

  it('uses the type-icon fallback for unknown keys', () => {
    expect(accountLogoPresentation('unknown', 'bank')).toBe('fallback');
  });
});
