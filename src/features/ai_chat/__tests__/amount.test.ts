import { extractAmountCandidates, parseRupiah } from '../amount';

describe('parseRupiah', () => {
  test.each([
    ['25rb', 25000],
    ['25 ribu', 25000],
    ['25k', 25000],
    ['25RB', 25000],
    ['1,5jt', 1500000],
    ['1.5 jt', 1500000],
    ['1,5 juta', 1500000],
    ['8jt', 8000000],
    ['0,5jt', 500000],
    ['1,25jt', 1250000],
    ['2,5rb', 2500],
    ['150000', 150000],
    ['150.000', 150000],
    ['rp150.000', 150000],
    ['Rp 150.000', 150000],
    ['Rp. 1.250.000', 1250000],
    ['1.500', 1500],
    ['562 ribu', 562000],
    ['54.990', 54990],
  ])('%s = %i', (text, value) => {
    expect(parseRupiah(text)).toBe(value);
  });

  test.each(['2k5', '1,5', '1.5', 'dua puluh ribu', '', 'rb', '25 rb rb', '0', '0rb', '1,234,5jt', '12.34.567', '25x', null, undefined])('%p is not recognised', text => {
    expect(parseRupiah(text as string)).toBeNull();
  });

  test('a number too large for the app is not recognised', () => {
    expect(parseRupiah('9999999999999')).toBeNull();
  });
});

describe('extractAmountCandidates', () => {
  const values = (m: string) => extractAmountCandidates(m).map(c => c.value);

  test('finds every amount of the message, in order', () => {
    expect(values('kopi 25rb pake gopay')).toEqual([25000]);
    expect(values('makan siang 48rb cash, parkir 5rb')).toEqual([48000, 5000]);
    expect(values('beli headphone 1,5jt pake cash')).toEqual([1500000]);
    expect(values('gaji masuk 8jt ke bca.')).toEqual([8000000]);
    expect(values('bayar Rp150.000.')).toEqual([150000]);
    expect(values('transfer 500 ribu')).toEqual([500000]);
  });

  test('a message without a number has no candidates; "2k5" is never read as 2.500', () => {
    expect(values('kopi pake gopay')).toEqual([]);
    expect(values('beli kopi 2k5')).not.toContain(2500);
  });
});
