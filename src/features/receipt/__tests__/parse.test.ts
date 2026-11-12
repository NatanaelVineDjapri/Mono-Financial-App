// parse.ts on receipt text. The samples are lines in the shape ML Kit returns (one string per
// printed line) and follow the common layouts of Indonesian minimarket, restaurant and cafe
// receipts. They are written for these tests, not captured from a real receipt, so a layout the
// samples do not cover is a case to add here when one turns up.
import { amountsOnLine, classify, datesIn, findDate, findMerchant, findTotals, isReadable, pairColumns, parseReceipt } from '../parse';

const TODAY = '2026-10-28';

const totalsOf = (lines: string[]) => findTotals(lines).map(c => c.amount);

describe('twelve and more receipts, end to end', () => {
  test('1. Indomaret: TOTAL, TUNAI, KEMBALI', () => {
    const parsed = parseReceipt(
      [
        'INDOMARET CIPUTAT RAYA',
        'PT INDOMARCO PRISMATAMA',
        'JL. RAYA CIPUTAT NO. 12',
        'TANGERANG SELATAN',
        'NPWP 01.337.994.6-092.000',
        '28/10/2026 12:41:09 KASIR 01',
        'AQUA 600ML 2 6.000',
        'ROTI TAWAR 1 17.000',
        'SUSU UHT 1 25.000',
        'TOTAL ITEM 4',
        'TOTAL 48.000',
        'TUNAI 50.000',
        'KEMBALI 2.000',
        'TERIMA KASIH',
      ],
      TODAY,
    );
    expect(parsed).toMatchObject({ merchant: 'Indomaret Ciputat Raya', date: '2026-10-28', dateFromReceipt: true, foreignCurrency: false });
    expect(parsed.totals.map(t => t.amount)).toEqual([48000]);
  });

  test('2. Alfamart: TOTAL BELANJA, the date as dd-mm-yy', () => {
    const parsed = parseReceipt(
      ['ALFAMART', 'PT SUMBER ALFARIA TRIJAYA TBK', 'JL KEBON JERUK RAYA 21', '27-10-26 18:03', 'INDOMIE GORENG 5 PCS 16.500', 'TELUR 1/2 KG 16.000', 'HARGA JUAL 32.500', 'TOTAL BELANJA 32.500', 'TUNAI 50.000', 'KEMBALI 17.500'],
      TODAY,
    );
    expect(parsed).toMatchObject({ merchant: 'Alfamart', date: '2026-10-27' });
    expect(parsed.totals.map(t => t.amount)).toEqual([32500]);
  });

  test('3. a restaurant with PB1: the subtotal is not the total', () => {
    const parsed = parseReceipt(
      ['RM PADANG SEDERHANA', 'JL. MELATI NO 5', '28 Okt 2026 13:15', 'NASI RENDANG 1 35.000', 'ES TEH 2 12.000', 'SUBTOTAL 47.000', 'PB1 10% 4.700', 'TOTAL 51.700'],
      TODAY,
    );
    expect(parsed).toMatchObject({ merchant: 'RM Padang Sederhana', date: '2026-10-28' });
    expect(parsed.totals.map(t => t.amount)).toEqual([51700]);
  });

  test('4. service and PPN: GRAND TOTAL wins over the first TOTAL, and the card line agrees', () => {
    const parsed = parseReceipt(
      ['THE WARUNG KOPI', 'Jl. Senopati 8', '2026-10-26 20:11', 'Nasi Goreng 2 x 38.000 76.000', 'Kopi Susu 2 x 28.000 56.000', 'TOTAL 132.000', 'SERVICE 5% 6.600', 'PPN 10% 13.860', 'GRAND TOTAL 152.460', 'DEBIT BCA 152.460'],
      TODAY,
    );
    expect(parsed.merchant).toBe('The Warung Kopi');
    expect(parsed.date).toBe('2026-10-26');
    expect(parsed.totals.map(t => t.amount)).toEqual([152460]);
  });

  test('5. two totals that score close are both returned, best first, as chips', () => {
    const parsed = parseReceipt(['BAKMI GM', '28/10/2026', 'TOTAL 100.000', 'GRAND TOTAL 110.000'], TODAY);
    expect(parsed.totals.map(t => t.amount)).toEqual([110000, 100000]);
    expect(parsed.totals[0].score).toBeGreaterThan(parsed.totals[1].score);
  });

  test('6. no TOTAL line, but TUNAI and KEMBALI: the total is the difference', () => {
    const parsed = parseReceipt(['TOKO BU SARI', 'Jl. Pasar Baru', '28/10/2026', 'Beras 5kg 65.000', 'Minyak 32.000', 'TUNAI 100.000', 'KEMBALI 3.000'], TODAY);
    expect(parsed.merchant).toBe('Toko Bu Sari');
    expect(parsed.totals.map(t => t.amount)).toEqual([97000]);
  });

  test('7. messy OCR: O for 0, S for 5 inside the numbers and the date', () => {
    const parsed = parseReceipt(['T0KO SUMBER REJEKI', '28/1O/2O26 12:41', 'T0TAL 4S.OOO', 'TUNAI 5O.OOO', 'KEMBALI 2.OOO'], TODAY);
    expect(parsed).toMatchObject({ merchant: 'Toko Sumber Rejeki', date: '2026-10-28', dateFromReceipt: true });
    expect(parsed.totals.map(t => t.amount)).toEqual([45000]);
  });

  test('8. messy OCR: the labels as one block and the values as another', () => {
    const parsed = parseReceipt(['INDOMARET POINT', '28/10/2026 09:02', 'TOTAL', 'TUNAI', 'KEMBALI', '48.000', '50.000', '2.000'], TODAY);
    expect(parsed.merchant).toBe('Indomaret Point');
    expect(parsed.totals.map(t => t.amount)).toEqual([48000]);
  });

  test('9. Rp prefixes and ,00 decimals', () => {
    const parsed = parseReceipt(['ALFAMIDI', '28/10/2026', 'Total Belanja Rp 48.000,00', 'Tunai Rp 50.000,00', 'Kembali Rp 2.000,00'], TODAY);
    expect(parsed.totals.map(t => t.amount)).toEqual([48000]);
  });

  test('10. paid by QRIS only: the payment line is the only hint, and a long date is read', () => {
    const parsed = parseReceipt(['KOPI KENANGAN', 'Jl. Sudirman', '28 Oktober 2026 07:45', 'Kopi Susu Tetangga 1 24.000', 'QRIS GOPAY 24.000'], TODAY);
    expect(parsed).toMatchObject({ merchant: 'Kopi Kenangan', date: '2026-10-28' });
    expect(parsed.totals.map(t => t.amount)).toEqual([24000]);
  });

  test('11. a foreign-currency receipt is flagged and gives no rupiah total', () => {
    const parsed = parseReceipt(['STARBUCKS SINGAPORE', '15/10/2026', 'Latte 1 S$ 6.50', 'TOTAL S$ 12.50'], TODAY);
    expect(parsed.foreignCurrency).toBe(true);
    expect(parsed.totals).toEqual([]);
    expect(isReadable(parsed)).toBe(false);
  });

  test('12. text with no total at all is not readable', () => {
    const parsed = parseReceipt(['Jl. Raya Bogor Km 30', 'terima kasih', 'barang yang sudah dibeli tidak dapat ditukar'], TODAY);
    expect(parsed.totals).toEqual([]);
    expect(isReadable(parsed)).toBe(false);
  });

  test('13. TOTAL alone on a line, its value on the next', () => {
    const parsed = parseReceipt(['WARUNG MAKAN BU TINI', '28/10/2026', 'TOTAL', '23.500'], TODAY);
    expect(parsed.totals.map(t => t.amount)).toEqual([23500]);
  });

  test('14. a date in the future falls back to today', () => {
    const parsed = parseReceipt(['TOKO ABADI', '28/10/2027', 'TOTAL 15.000'], TODAY);
    expect(parsed).toMatchObject({ date: TODAY, dateFromReceipt: false });
  });

  test('15. TOTAL HEMAT and TOTAL ITEM are not the total', () => {
    const parsed = parseReceipt(['SUPERINDO', '28/10/2026', 'TOTAL ITEM 9', 'TOTAL BELANJA 215.400', 'TOTAL HEMAT 12.600', 'TUNAI 220.000', 'KEMBALI 4.600'], TODAY);
    expect(parsed.totals.map(t => t.amount)).toEqual([215400]);
  });

  test('16. JUMLAH is a total too, and the 2-digit year is 20yy', () => {
    const parsed = parseReceipt(['TOKO OBAT SEHAT', '28-10-26', 'JUMLAH 87.500'], TODAY);
    expect(parsed).toMatchObject({ merchant: 'Toko Obat Sehat', date: '2026-10-28' });
    expect(parsed.totals.map(t => t.amount)).toEqual([87500]);
  });

  test('18. a photographed restaurant receipt: branch name, an old date, SUBTOTAL, service and PB1 before the total', () => {
    const parsed = parseReceipt(
      [
        'Warung Pasta',
        '@ KEMANG',
        'KEMANG RAYA NO.88',
        'Jakarta Selatan',
        'P.7193776 F.7193776',
        'Table # 32',
        'Guest # 2',
        '1 Cheezy Freezy M 25.000',
        '1 Red Bull M 25.000',
        '1 Lemon Tea 11.000',
        '1 Cappucinno Frozen 19.000',
        'Subtotal 80.000',
        'Serv 5% 4.000',
        'PB 1 10% 8.400',
        '4 Total 92.400',
        'Monday 16-11-15 16:04:52',
        'L0001 MARRA',
        'THANK YOU',
        'FOR YOUR VISIT',
      ],
      TODAY,
    );
    expect(parsed).toMatchObject({ merchant: 'Warung Pasta @ Kemang', date: '2015-11-16', dateFromReceipt: true, foreignCurrency: false });
    expect(parsed.totals.map(t => t.amount)).toEqual([92400]);
  });

  test('17. a cash total larger than the cash handed over is doubted', () => {
    // 105.000 was paid, 5.000 given back: the 150.000 read for TOTAL cannot be right.
    const totals = findTotals(['TOTAL 150.000', 'GRAND TOTAL 100.000', 'TUNAI 105.000', 'KEMBALI 5.000']);
    expect(totals[0].amount).toBe(100000);
  });
});

describe('amounts', () => {
  test.each([
    ['TOTAL 48.000', [48000]],
    ['TOTAL 48,000', [48000]],
    ['TOTAL 48000', [48000]],
    ['Rp48.000', [48000]],
    ['Rp 1.250.000', [1250000]],
    ['IDR 48.000', [48000]],
    ['48.000,00', [48000]],
    ['48,000.00', [48000]],
    ['TOTAL 2 x 24.000 = 48.000', [24000, 48000]],
    ['4S.OOO', [45000]],
    ['KEMBALI 2.OOO', [2000]],
    ['081234567890', []],
    ['TOTAL 12 ITEM', []],
    ['S.OOO', []],
  ])('%s', (line, expected) => {
    expect(amountsOnLine(line)).toEqual(expected);
  });
});

describe('what is never the total', () => {
  test('phone and tax numbers on lines with no label are not totals', () => {
    expect(totalsOf(['NPWP 01.337.994.6-092.000', 'TELP 0812 3456 7890', 'KASIR 01 ID 8821'])).toEqual([]);
  });

  test.each(['SUBTOTAL 47.000', 'SUB TOTAL 47.000', 'TUNAI 50.000', 'CASH 50.000', 'KEMBALI 2.000', 'PPN 10% 4.700', 'PB1 10% 4.700', 'DISKON 5.000', 'SERVICE 5% 2.350', 'TOTAL DISKON 3.000', 'TOTAL PPN 4.700'])('%s', line => {
    expect(totalsOf([line])).toEqual([]);
  });

  test('labels are classified', () => {
    expect(classify('GRAND TOTAL 1')).toBe('grand');
    expect(classify('Total Bayar')).toBe('grand');
    expect(classify('TOTAL')).toBe('total');
    expect(classify('SUBTOTAL')).toBe('subtotal');
    expect(classify('TUNAI')).toBe('cash');
    expect(classify('KEMBALIAN')).toBe('change');
    expect(classify('JUMLAH')).toBe('sum');
    expect(classify('JUMLAH ITEM')).toBeNull();
    expect(classify('INDOMIE GORENG')).toBeNull();
  });
});

describe('split columns', () => {
  test('a run of labels followed by a run of values is paired in order', () => {
    expect(pairColumns(['TOTAL', 'TUNAI', 'KEMBALI', '48.000', '50.000', '2.000'])).toEqual(['TOTAL 48.000', 'TUNAI 50.000', 'KEMBALI 2.000']);
  });

  test('labels with their values on the same line are left alone', () => {
    expect(pairColumns(['TOTAL 48.000', 'TUNAI 50.000'])).toEqual(['TOTAL 48.000', 'TUNAI 50.000']);
  });

  test('fewer values than labels: nothing is paired by guessing', () => {
    expect(pairColumns(['TOTAL', 'TUNAI', 'KEMBALI', '48.000'])).toEqual(['TOTAL', 'TUNAI', 'KEMBALI', '48.000']);
  });
});

describe('dates', () => {
  test.each([
    ['28/10/2026', '2026-10-28'],
    ['28-10-2026', '2026-10-28'],
    ['28.10.2026', '2026-10-28'],
    ['28/10/26', '2026-10-28'],
    ['5/3/2026', '2026-03-05'],
    ['2026-10-28', '2026-10-28'],
    ['2026/10/28', '2026-10-28'],
    ['28 Okt 2026', '2026-10-28'],
    ['28 Oktober 2026', '2026-10-28'],
    ['28-Okt-26', '2026-10-28'],
    ['28 Oct 2026', '2026-10-28'],
    ['03 Agu 2026', '2026-08-03'],
    ['03 Agt 2026', '2026-08-03'],
    ['12 Mei 2026', '2026-05-12'],
    ['01 Des 2025', '2025-12-01'],
    ['10/28/2026', '2026-10-28'], // month first, only when day-first cannot be a date
    ['Tgl: 28/10/2026 12:41:09', '2026-10-28'],
  ])('%s', (text, expected) => {
    expect(datesIn([text])).toEqual([expected]);
  });

  test.each(['31/02/2026', '12.41.05', '99/99/2026', '28/13/2026', 'NPWP 01.337.994', '28/10/202'])('%s is not a date', text => {
    expect(datesIn([text])).toEqual([]);
  });

  test('the first date that is real and not in the future is used; none gives today', () => {
    expect(findDate(['TOKO', '31/02/2026', '15/10/2026', '20/10/2026'], TODAY)).toEqual({ date: '2026-10-15', fromReceipt: true });
    expect(findDate(['29/10/2026', '20/10/2026'], TODAY)).toEqual({ date: '2026-10-20', fromReceipt: true });
    expect(findDate(['29/10/2026'], TODAY)).toEqual({ date: TODAY, fromReceipt: false });
    expect(findDate(['tidak ada tanggal'], TODAY)).toEqual({ date: TODAY, fromReceipt: false });
  });

  test('today itself is fine, and an old receipt keeps its own date (the form judges it against the account)', () => {
    expect(findDate(['28/10/2026'], TODAY).fromReceipt).toBe(true);
    expect(findDate(['16-11-15 16:04:52'], TODAY)).toEqual({ date: '2015-11-16', fromReceipt: true });
  });
});

describe('the shop name', () => {
  test('the first meaningful line, tidied', () => {
    expect(findMerchant(['TOKO SUMBER REJEKI', 'JL. MERDEKA 5'])).toBe('Toko Sumber Rejeki');
    expect(findMerchant(['  *** Kopi Tuku ***  ', 'Jl. Cipete'])).toBe('Kopi Tuku');
  });

  test('addresses, phone numbers, dates and receipt words are skipped', () => {
    expect(findMerchant(['STRUK PEMBAYARAN', 'JL. RAYA BOGOR KM 30', 'TELP 021-8765432', '28/10/2026', 'WARUNG BU SITI'])).toBe('Warung Bu Siti');
  });

  test('a legal-entity line is the fallback when nothing better is at the top', () => {
    expect(findMerchant(['PT INDOMARCO PRISMATAMA', 'JL. RAYA 1'])).toBe('PT Indomarco Prismatama');
    expect(findMerchant(['PT SUMBER ALFARIA TRIJAYA', 'ALFAMART', 'JL. RAYA 1'])).toBe('Alfamart');
  });

  test('abbreviations stay in capitals', () => {
    expect(findMerchant(['KFC SUDIRMAN'])).toBe('KFC Sudirman');
  });

  test('a branch on the next line belongs to the name', () => {
    expect(findMerchant(['Warung Pasta', '@ KEMANG', 'KEMANG RAYA NO.88'])).toBe('Warung Pasta @ Kemang');
    expect(findMerchant(['WARUNG PASTA', '@ KEMANG', 'Jakarta Selatan'])).toBe('Warung Pasta @ Kemang');
  });

  test('an e-mail address is still not a name', () => {
    expect(findMerchant(['halo@tokomaju.com', 'TOKO MAJU'])).toBe('Toko Maju');
  });

  test('nothing meaningful gives null', () => {
    expect(findMerchant(['', '12345', '28/10/2026', 'TOTAL 5.000'])).toBeNull();
  });
});
