// The texts below are ILLUSTRATIVE: ordinary Indonesian payment wording written for these tests. They are NOT copied
// from any bank or e-wallet app (CLAUDE.md rule 14: a bank's own format is never invented; a parser of an app's own
// is written only from real samples). They check what the GENERAL parser promises: it finds an amount and a verb,
// it prefers to drop a notification rather than guess, and it never keeps a number that is not the amount.
import { findAmount, parseGeneric } from '../generic';
import { parseNotification } from '../index';

describe('what is read', () => {
  test('a payment: expense, amount and merchant', () => {
    expect(parseGeneric('Pembayaran berhasil', 'Kamu membayar Rp25.000 di Kopi Kenangan pada 5 Nov 2026')).toEqual({ kind: 'expense', amountIdr: 25000, merchant: 'Kopi Kenangan' });
  });

  test('money received: income, with who it came from', () => {
    expect(parseGeneric('Dana masuk', 'Kamu menerima Rp1.250.000 dari Budi Santoso. Saldo kamu Rp3.000.000')).toEqual({ kind: 'income', amountIdr: 1250000, merchant: 'Budi Santoso' });
  });

  test('the title and the text are read together', () => {
    expect(parseGeneric('Pembayaran QRIS', 'Rp18.500 di Warung Bu Tini')).toMatchObject({ kind: 'expense', amountIdr: 18500, merchant: 'Warung Bu Tini' });
  });

  test('English wording works too', () => {
    expect(parseGeneric(null, 'You paid Rp50.000 to Starbucks')).toEqual({ kind: 'expense', amountIdr: 50000, merchant: 'Starbucks' });
  });

  test('a shouted merchant name is written in Title Case', () => {
    expect(parseGeneric(null, 'Pembayaran Rp12.000 di KOPI KENANGAN pada 5 Nov')?.merchant).toBe('Kopi Kenangan');
  });
});

describe('unclear: the person chooses', () => {
  test('a top up could be either', () => {
    expect(parseGeneric('Top up berhasil', 'Top up Rp100.000 berhasil')).toEqual({ kind: null, amountIdr: 100000, merchant: '' });
  });

  test('words of both kinds: not guessed', () => {
    expect(parseGeneric('Pembayaran diterima', 'Pembayaran Rp75.000 diterima')?.kind).toBeNull();
  });

  test('a successful transaction with no direction', () => {
    expect(parseGeneric(null, 'Transaksi berhasil Rp40.000')).toMatchObject({ kind: null, amountIdr: 40000 });
  });
});

describe('thrown away, not guessed', () => {
  test.each([
    ['a one-time code', 'Kode OTP kamu 123456. Jangan berikan kode ini ke siapa pun. Rp0'],
    ['a verification code', 'Kode verifikasi pembayaran Rp25.000 adalah 4821'],
    ['a balance notice', 'Saldo kamu Rp5.000.000'],
    ['a promotion', 'Promo diskon 50% hingga Rp10.000 untuk kamu, dapatkan sekarang'],
    ['a bill reminder', 'Tagihan listrik kamu Rp562.000 jatuh tempo besok'],
    ['a text without an amount', 'Pembayaran berhasil, terima kasih'],
    ['an amount without any word for money moving', 'Harga Rp25.000'],
    ['an empty notification', ''],
  ])('%s', (_name, text) => {
    expect(parseGeneric(null, text)).toBeNull();
  });

  test('both parts empty', () => {
    expect(parseGeneric(null, null)).toBeNull();
    expect(parseGeneric('', '   ')).toBeNull();
  });

  test('an absurd amount', () => {
    expect(parseGeneric(null, 'Pembayaran Rp99.999.999.999.999.999')).toBeNull();
  });
});

describe('the amount', () => {
  test('a balance before or after the payment is never taken as the payment', () => {
    expect(findAmount('Pembayaran Rp25.000. Sisa saldo Rp975.000')).toBe(25000);
    expect(findAmount('Saldo Rp975.000. Pembayaran Rp25.000')).toBe(25000);
    expect(findAmount('Saldo kamu saat ini Rp975.000, bayar Rp25.000')).toBe(25000);
  });

  test.each([
    ['Rp25.000', 25000],
    ['Rp 1.250.000', 1250000],
    ['Rp25000', 25000],
    ['IDR 25,000.00', 25000],
    ['Rp 1.250.000,50', 1250001], // the cents are dropped, half up
    ['Rp1.250.000,49', 1250000],
    ['rp. 7.500', 7500],
  ])('%s is %i', (text, value) => {
    expect(findAmount(`Bayar ${text}`)).toBe(value);
  });

  test('no rupiah sign: no amount (a bare number could be anything)', () => {
    expect(findAmount('Bayar 25000')).toBeNull();
  });
});

describe('the merchant', () => {
  test('a phone or account number is never kept as a name', () => {
    expect(parseGeneric(null, 'Transfer ke 081234567890 Rp50.000 berhasil')?.merchant).toBe('');
    expect(parseGeneric(null, 'Pembayaran Rp50.000 ke Toko Maju 1234567890123')?.merchant).toBe('Toko Maju');
  });

  test('"ke rekening" and "di bank" are not merchants', () => {
    expect(parseGeneric(null, 'Transfer ke rekening Anda Rp50.000 berhasil')?.merchant).toBe('');
  });

  test('a long name is cut to 40 characters', () => {
    const long = 'Toko Serba Ada Sentosa Makmur Jaya Abadi Selamanya Tanpa Batas';
    expect((parseGeneric(null, `Pembayaran Rp10.000 di ${long}`)?.merchant ?? '').length).toBeLessThanOrEqual(40);
  });

  test('no merchant in the text: empty, not made up', () => {
    expect(parseGeneric(null, 'Pembayaran Rp10.000 berhasil')?.merchant).toBe('');
  });
});

describe('parseNotification', () => {
  test('everything is read by the general parser and says so: no app has a parser of its own', () => {
    expect(parseNotification('com.example.wallet', 'Pembayaran', 'Kamu membayar Rp25.000 di Kopi Kenangan')).toEqual({ kind: 'expense', amountIdr: 25000, merchant: 'Kopi Kenangan', level: 'generic' });
  });

  test('a notification that is not a transaction gives nothing', () => {
    expect(parseNotification('com.example.wallet', 'Promo', 'Diskon besar Rp10.000')).toBeNull();
  });
});

describe('a bank saying only "transfer"', () => {
  test('"Transfer Dana Berhasil Rp100.000" is read as money that moved, direction left for the person to choose', () => {
    expect(parseGeneric('Transfer Dana Berhasil', 'Nominal Rp100.000')).toMatchObject({ kind: null, amountIdr: 100000 });
  });

  test('"transfer dana ke Budi Rp100.000" is an expense', () => {
    expect(parseGeneric('Info', 'Transfer dana ke Budi Rp100.000')).toMatchObject({ kind: 'expense', amountIdr: 100000 });
  });

  test('a QRIS payment is an expense', () => {
    expect(parseGeneric('QRIS', 'Pembayaran QRIS Rp25.000 di Kopi Kenangan')).toMatchObject({ kind: 'expense', amountIdr: 25000 });
  });
});

// The shape of a real myBCA "Catatan Finansial" notification (title and wording as the app posts it); the name is made up,
// masked the way BCA masks it.
describe('myBCA Catatan Finansial', () => {
  test('money in: income, the amount in IDR, the masked sender kept as shown, the category left out', () => {
    expect(parseGeneric('Catatan Finansial', 'Pemasukan sebesar IDR 1.00 dari ***DI SANT**O *A di kategori Transfer Rekening.')).toEqual({
      kind: 'income',
      amountIdr: 1,
      merchant: '***DI SANT**O *A',
    });
  });

  test('money out names no merchant: only the amount and the direction are in the message', () => {
    for (const category of ['Pembayaran', 'Transfer Rekening', 'Uang Tunai', 'Tagihan Rutin']) {
      expect(parseGeneric('Catatan Finansial', `Pengeluaran sebesar IDR 52,760.00 di kategori ${category}.`)).toEqual({ kind: 'expense', amountIdr: 52760, merchant: '' });
    }
  });

  test('a cancelled payment is never taken as spent: the person decides', () => {
    expect(parseGeneric('Catatan Finansial', 'Pengeluaran sebesar IDR 10,000.00 di kategori Pendidikan yang dilakukan tanggal 21 November 2026 dibatalkan.')).toEqual({
      kind: null,
      amountIdr: 10000,
      merchant: 'Dibatalkan',
    });
  });

  test('larger amounts with thousands and cents', () => {
    expect(parseGeneric('Catatan Finansial', 'Pemasukan sebesar IDR 1,250,000.00 dari ***DI SANT**O *A di kategori Transfer Rekening.')?.amountIdr).toBe(1250000);
  });
});

