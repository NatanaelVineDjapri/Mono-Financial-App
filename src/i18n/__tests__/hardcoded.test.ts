// A guard against text written straight into a screen. Every sentence the person reads goes through
// src/i18n (so it exists in English and Indonesian). This reads the app's source and fails when a
// string literal or JSX text outside the dictionaries contains an unmistakably Indonesian word.
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');

// Words that are Indonesian and not English. (Words both languages use, like "total", "bank" or
// "valas", are left out on purpose.)
const WORDS = [
  'kamu', 'saya', 'aku', 'yang', 'untuk', 'dengan', 'atau', 'dari', 'tidak', 'belum', 'sudah', 'akan', 'masih', 'bisa',
  'simpan', 'batal', 'hapus', 'ubah', 'tambah', 'buka', 'tutup', 'kembali', 'lanjut', 'lewati', 'kirim', 'tempel', 'coba', 'catat',
  'akun', 'saldo', 'uang', 'transaksi', 'pengeluaran', 'pemasukan', 'cadangan', 'pemulihan', 'anggaran', 'kategori', 'laporan',
  'pengaturan', 'bahasa', 'tanggal', 'kemarin', 'jumlah', 'nominal', 'kunci', 'ditolak', 'tersimpan', 'gagal', 'berhasil',
  'pesan', 'balasan', 'pertanyaan', 'draf', 'layar', 'tombol', 'ketuk', 'tampilkan', 'sembunyikan', 'contoh', 'muat', 'pakai',
  'databasenya', 'dibuka', 'ditampilkan', 'simulasi', 'skala', 'setengah', 'makanan',
];
const PATTERN = new RegExp(`\\b(${WORDS.join('|')})\\b`, 'i');

// Files whose Indonesian text is on purpose: the dictionaries, the model's own prompt (it parses
// Indonesian shorthand) and the Indonesian month names used when the language is Indonesian.
const ALLOWED = [
  'i18n/',
  'features/ai_chat/prompt.ts',
  'features/ai_chat/receiptTidy.ts',
  'features/more/backupStatus.ts',
  // Category names the scan looks for in the person's own list (Indonesian ones included).
  'features/receipt/draft.ts',
  '__tests__/',
  '.test.',
];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

// Comments are not text on a screen: drop block comments and whole-line and trailing // comments.
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => (line.trim().startsWith('//') ? '' : line.replace(/\s\/\/\s.*$/, '')))
    .join('\n');
}

const STRING = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g;
const JSX_TEXT = />([^<>{}\n]+)</g;

describe('no Indonesian text written straight into the app', () => {
  test('every string literal and JSX text outside the dictionaries is free of Indonesian words', () => {
    const offenders: string[] = [];
    for (const file of files(ROOT)) {
      const relative = file.slice(ROOT.length + 1).split(path.sep).join('/');
      if (ALLOWED.some(a => relative.includes(a))) continue;
      const code = withoutComments(fs.readFileSync(file, 'utf8'));
      code.split('\n').forEach((line, index) => {
        const texts = [...line.matchAll(STRING)].map(m => m[1] ?? m[2] ?? m[3] ?? '').concat([...line.matchAll(JSX_TEXT)].map(m => m[1]));
        for (const text of texts) {
          if (text && !text.startsWith('@/') && !text.startsWith('.') && PATTERN.test(text)) offenders.push(`${relative}:${index + 1}: ${text.trim().slice(0, 80)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test('nothing outside src/i18n imports id.ts or en.ts directly: text goes through the language picker', () => {
    const direct: string[] = [];
    for (const file of files(ROOT)) {
      const relative = file.slice(ROOT.length + 1).split(path.sep).join('/');
      if (relative.startsWith('i18n/') || relative.includes('__tests__/') || relative.includes('.test.')) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/from\s+['"][^'"]*i18n\/(id|en)['"]/.test(source)) direct.push(relative);
    }
    expect(direct).toEqual([]);
  });

  test('the scan itself catches what it should', () => {
    expect(PATTERN.test('Simpan perubahan')).toBe(true);
    expect(PATTERN.test('Save changes')).toBe(false);
    expect(PATTERN.test('Total balance')).toBe(false);
  });
});
