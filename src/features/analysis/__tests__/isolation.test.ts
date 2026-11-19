// The health score is a formula on the phone (CLAUDE.md rules 8, 9 and 23): no network, no language model, no new
// table, nothing stored. The optional AI review has its own folder (src/features/analysis/ai) and is the only part
// of the feature allowed to touch the AI module. These checks read the source so a later change cannot quietly
// break that.
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', '..', '..');

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : files(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const read = (file: string) => fs.readFileSync(file, 'utf8');
const rel = (file: string) => path.relative(SRC, file).split(path.sep).join('/');

// Source without its comments (block comments and whole-line // comments).
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
}

// The optional AI review has its own folder; everything else is the formula and must stay clear of the AI.
const AI_DIR = path.join(SRC, 'features', 'analysis', 'ai');
const SCORE_FILES = [
  ...files(path.join(SRC, 'domain', 'health')),
  ...files(path.join(SRC, 'features', 'analysis')).filter(f => !f.startsWith(AI_DIR)),
  path.join(SRC, 'data', 'repo', 'analysis.ts'),
  path.join(SRC, 'app', 'analysis.tsx'),
  ...files(path.join(SRC, 'app', 'analysis')),
];

describe('the health score stays a formula', () => {
  test('the files exist (so the checks below mean something)', () => {
    expect(SCORE_FILES.length).toBeGreaterThan(8);
  });

  test('the AI chat imports nothing from the health domain or the analysis feature', () => {
    for (const file of files(path.join(SRC, 'features', 'ai_chat'))) {
      expect([rel(file), /(domain\/health|features\/analysis)/.test(read(file))]).toEqual([rel(file), false]);
    }
  });

  test('the score code uses no network, no AI module and no model name', () => {
    for (const file of SCORE_FILES) {
      const text = code(file);
      expect([rel(file), /\bfetch\s*\(/.test(text)]).toEqual([rel(file), false]);
      expect([rel(file), /ai_chat/.test(text)]).toEqual([rel(file), false]);
      expect([rel(file), /gemini|XMLHttpRequest|WebSocket/i.test(text)]).toEqual([rel(file), false]);
    }
  });

  test('it only reads: no insert, update, delete or schema change in its SQL', () => {
    for (const file of SCORE_FILES) {
      const text = read(file);
      expect([rel(file), /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|create\s+table|alter\s+table|drop\s+table)\b/i.test(text)]).toEqual([rel(file), false]);
      expect([rel(file), /\brunAsync\b|\bexecAsync\b/.test(text)]).toEqual([rel(file), false]);
    }
  });

  test('the score is not saved anywhere: no settings or storage write', () => {
    for (const file of SCORE_FILES) {
      expect([rel(file), /setSetting|AsyncStorage|SecureStore|localStorage/.test(read(file))]).toEqual([rel(file), false]);
    }
  });

  test('the pure domain imports no database, no React and no React Native', () => {
    for (const file of files(path.join(SRC, 'domain', 'health'))) {
      expect([rel(file), /from '(react|react-native|expo[^']*|@\/data[^']*|\.\.\/\.\.\/data[^']*)'/.test(read(file))]).toEqual([rel(file), false]);
    }
  });

  test('no other module in the app reaches into the score except its own screens and the More row', () => {
    const allowed = ['domain/health/', 'features/analysis/', 'app/analysis', 'app/more.tsx', 'data/repo/analysis.ts'];
    for (const file of files(SRC)) {
      const r = rel(file);
      if (allowed.some(a => r.startsWith(a)) || r.includes('__tests__')) continue;
      expect([r, /(domain\/health|features\/analysis)/.test(read(file))]).toEqual([r, false]);
    }
  });
});

describe('the optional AI review', () => {
  test('is the only part of the Analysis feature that touches the AI module, and makes no request of its own', () => {
    const aiFiles = files(AI_DIR);
    expect(aiFiles.length).toBeGreaterThanOrEqual(4);
    // the only network code is src/features/ai_chat
    for (const file of aiFiles) expect([rel(file), /\bfetch\s*\(/.test(code(file))]).toEqual([rel(file), false]);
    // nothing in the formula or the score screen's data imports it, except the screen that shows the card
    for (const file of SCORE_FILES) {
      if (rel(file) === 'app/analysis.tsx') continue;
      expect([rel(file), /analysis\/ai\//.test(read(file))]).toEqual([rel(file), false]);
    }
  });

  test('never writes a figure: it reads, and keeps its answer in memory only', () => {
    for (const file of files(AI_DIR)) {
      const text = read(file);
      expect([rel(file), /\b(insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i.test(text)]).toEqual([rel(file), false]);
      expect([rel(file), /AsyncStorage|SecureStore|writeAsStringAsync/.test(text)]).toEqual([rel(file), false]);
    }
  });

  test('does not feed the score: the health domain imports nothing from the features', () => {
    for (const file of files(path.join(SRC, 'domain', 'health'))) {
      expect([rel(file), /from '[^']*features\//.test(read(file))]).toEqual([rel(file), false]);
    }
  });
});
