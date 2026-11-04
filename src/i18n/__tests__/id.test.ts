import { GUARD_CODES } from '../../domain/errors';
import { guardMessage } from '../id';

describe('guardMessage', () => {
  test('every guard code has a non-empty message', () => {
    for (const code of GUARD_CODES) {
      expect(guardMessage(code).length).toBeGreaterThan(0);
    }
  });

  test('insufficient_balance uses the pre-checked shortfall when given one', () => {
    expect(guardMessage('insufficient_balance', { shortfall: 1050000 })).toBe('Kurang Rp1.050.000.');
  });

  test('insufficient_balance falls back to a generic message without a shortfall', () => {
    expect(guardMessage('insufficient_balance')).toBe('Saldonya gak cukup.');
  });

  test('currency_not_in_account names the currency when given one', () => {
    expect(guardMessage('currency_not_in_account', { currency: 'SGD' })).toBe('Akun ini gak punya kantong SGD.');
  });

  test('missing_fx_rate names the currency when given one', () => {
    expect(guardMessage('missing_fx_rate', { currency: 'SGD' })).toBe('Tambahkan kurs SGD dulu.');
  });

  test('codes that need no extra context ignore it if given anyway', () => {
    expect(guardMessage('future_date', { shortfall: 1 })).toBe('Tanggalnya gak boleh di masa depan.');
  });
});
