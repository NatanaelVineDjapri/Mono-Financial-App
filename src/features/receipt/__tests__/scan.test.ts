// The scan pipeline with the recognizer mocked: what comes out for a good receipt, a foreign one,
// an unreadable one and a recognizer that throws.
import { discardCachedImage } from '../cache';
import { readReceiptLines } from '../ocr';
import { scanImage } from '../scan';

jest.mock('../ocr', () => ({ readReceiptLines: jest.fn() }));
jest.mock('../cache', () => ({ discardCachedImage: jest.fn() }));

const discard = discardCachedImage as jest.MockedFunction<typeof discardCachedImage>;

const read = readReceiptLines as jest.MockedFunction<typeof readReceiptLines>;
const TODAY = '2026-10-28';

describe('scanImage', () => {
  beforeEach(() => discard.mockClear());

  test('a readable receipt gives a parsed draft', async () => {
    read.mockResolvedValue(['TOKO SUMBER REJEKI', '28/10/2026 12:41', 'TOTAL 48.000', 'TUNAI 50.000', 'KEMBALI 2.000']);
    const outcome = await scanImage('file:///cache/a.jpg', TODAY);
    expect(outcome).toMatchObject({ ok: true, parsed: { merchant: 'Toko Sumber Rejeki', date: '2026-10-28' } });
    expect(outcome.ok && outcome.parsed.totals.map(t => t.amount)).toEqual([48000]);
    // the picture stays for the review's thumbnail; the store deletes it later
    expect(outcome.ok && outcome.imageUri).toBe('file:///cache/a.jpg');
    expect(discard).not.toHaveBeenCalled();
  });

  test('text with no total is not readable', async () => {
    read.mockResolvedValue(['terima kasih', 'selamat belanja kembali']);
    expect(await scanImage('file:///cache/a.jpg', TODAY)).toEqual({ ok: false, reason: 'unreadable' });
    expect(discard).toHaveBeenCalledWith('file:///cache/a.jpg');
  });

  test('nothing recognized at all is not readable', async () => {
    read.mockResolvedValue([]);
    expect(await scanImage('file:///cache/a.jpg', TODAY)).toEqual({ ok: false, reason: 'unreadable' });
    expect(discard).toHaveBeenCalledWith('file:///cache/a.jpg');
  });

  test('a foreign-currency receipt is refused for now', async () => {
    read.mockResolvedValue(['STARBUCKS', 'TOTAL USD 25.00']);
    expect(await scanImage('file:///cache/a.jpg', TODAY)).toEqual({ ok: false, reason: 'foreign' });
    expect(discard).toHaveBeenCalledWith('file:///cache/a.jpg');
  });

  test('a recognizer that throws is "unreadable", not a crash', async () => {
    read.mockRejectedValue(new Error('native module failed'));
    expect(await scanImage('file:///cache/a.jpg', TODAY)).toEqual({ ok: false, reason: 'unreadable' });
    expect(discard).toHaveBeenCalledWith('file:///cache/a.jpg');
  });
});
