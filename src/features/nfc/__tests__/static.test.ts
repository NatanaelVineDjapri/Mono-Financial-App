// Rules about the source itself (CLAUDE.md, the card scan): the card scan talks to no network and no AI, never writes a
// card number or a response to a log or a store, declares no NFC intent filter, and asks for no permission but NFC.
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', '..', '..');
const ROOT = path.join(SRC, '..');

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : files(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

// Everything of the card scan that is not a test: the feature, its domain, its routes, its repo.
const NFC_FILES = [
  ...files(path.join(SRC, 'features', 'nfc')),
  ...files(path.join(SRC, 'domain', 'cards')),
  ...files(path.join(SRC, 'app', 'nfc')),
  path.join(SRC, 'data', 'repo', 'cardLinks.ts'),
  path.join(SRC, 'core', 'cardAdjustment.ts'),
];

const rel = (file: string) => path.relative(SRC, file).replace(/\\/g, '/');
const code = (file: string) =>
  // Comments say things like "never logged": only the code is judged.
  fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => (line.trim().startsWith('//') ? '' : line.replace(/\s\/\/\s.*$/, ''))).join('\n');

test('the card scan has files to judge', () => {
  expect(NFC_FILES.length).toBeGreaterThan(20);
});

describe('no network, no AI', () => {
  test.each(NFC_FILES.map(f => [rel(f), f]))('%s', (_name, file) => {
    const text = code(file);
    expect(text).not.toMatch(/\bfetch\s*\(/);
    expect(text).not.toMatch(/XMLHttpRequest|WebSocket|axios|expo-network|@react-native-community\/netinfo/);
    // not the AI chat, the rate refresh or the map: the only modules allowed to use the network
    expect(text).not.toMatch(/from\s+['"][^'"]*(features\/ai_chat|features\/fx|features\/location|features\/import\/gmail)/);
    expect(text).not.toMatch(/from\s+['"][^'"]*(ai_chat|analysis\/ai)/);
  });
});

describe('a card number and a card response are never written anywhere', () => {
  test.each(NFC_FILES.map(f => [rel(f), f]))('%s has no console, log or storage call', (_name, file) => {
    const text = code(file);
    expect(text).not.toMatch(/\bconsole\s*\./);
    expect(text).not.toMatch(/\bAsyncStorage\b|\blocalStorage\b|\bMMKV\b|expo-secure-store|expo-file-system|writeAsStringAsync|Clipboard|Sharing\./);
    expect(text).not.toMatch(/Alert\.alert/);
  });

  test('the card number (pan) is spoken of only where it is read and turned into a fingerprint', () => {
    const allowed = ['features/nfc/adapters/', 'features/nfc/readCard.ts', 'features/nfc/mock/mockCardReader.ts', 'domain/cards/fingerprint.ts'];
    for (const file of NFC_FILES) {
      if (allowed.some(a => rel(file).startsWith(a))) continue;
      expect(code(file)).not.toMatch(/\bpan\b/i);
    }
  });

  test('the types the screens receive have no card number', () => {
    const types = code(path.join(SRC, 'domain', 'cards', 'types.ts'));
    expect(types).not.toMatch(/\bpan\b/i);
    const reader = code(path.join(SRC, 'features', 'nfc', 'reader.ts'));
    expect(reader).not.toMatch(/\bpan\b/i);
  });

  test('a card number reaches neither a SQL statement nor a table of the schema', () => {
    const schema = fs.readFileSync(path.join(SRC, 'data', 'db', 'migrations', 'v12_nfc_card_links.ts'), 'utf8');
    const columns = /CREATE TABLE card_links \(([\s\S]*?)\);/.exec(schema)![1];
    expect(columns).not.toMatch(/\bpan\b|card_number|balance/i);
    expect(columns.match(/^\s{2}(\w+)/gm)!.map(c => c.trim())).toEqual(['account_id', 'issuer', 'last4', 'fingerprint', 'linked_at']);
  });
});

describe('every command to a card goes through the one safe door', () => {
  test('only transceive.ts calls the native transceive', () => {
    for (const file of NFC_FILES) {
      if (rel(file) === 'features/nfc/transceive.ts') continue;
      const text = code(file);
      if (rel(file) === 'features/nfc/nfcManagerReader.ts') {
        // The one place that hands the radio to the safe door as a Transport.
        expect(text.match(/\.transceive\(/g)?.length).toBe(1);
        continue;
      }
      expect(text).not.toMatch(/\.transceive\(/);
    }
  });

  test('adapters talk to the card only through the CardIo they are given', () => {
    for (const file of files(path.join(SRC, 'features', 'nfc', 'adapters'))) {
      expect(code(file)).not.toMatch(/react-native-nfc-manager|NfcManager|isoDepHandler/);
    }
  });

  test('the native module is imported in one file, and loaded only when it is needed', () => {
    const importers = NFC_FILES.filter(f => /from\s+['"]react-native-nfc-manager['"]/.test(code(f))).map(rel);
    expect(importers).toEqual(['features/nfc/nfcManagerReader.ts']);
    expect(code(path.join(SRC, 'features', 'nfc', 'cardReaderProvider.ts'))).toMatch(/require\(['"]\.\/nfcManagerReader['"]\)/);
  });

  test('the pretend reader cannot be reached in a release build', () => {
    expect(code(path.join(SRC, 'features', 'nfc', 'mock', 'mockCardReader.ts'))).toMatch(/return __DEV__ && /);
  });
});

describe('the app declares only what the card scan needs', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;

  test('the NFC plugin is on, and NFC is not among the blocked permissions', () => {
    expect(appJson.plugins).toContain('react-native-nfc-manager');
    expect(appJson.android.blockedPermissions ?? []).not.toContain('android.permission.NFC');
  });

  test('no intent filter, no foreground service and no extra permission in the app config', () => {
    expect(appJson.android.intentFilters).toBeUndefined();
    expect(JSON.stringify(appJson)).not.toMatch(/android\.nfc\.action|FOREGROUND_SERVICE|intentFilters/);
    expect(appJson.android.permissions).toBeUndefined();
  });

  test('the manifest of the library asks for NFC and says the hardware is optional', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'node_modules', 'react-native-nfc-manager', 'android', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
    expect(lib).toContain('android.permission.NFC');
    expect(lib).toMatch(/android\.hardware\.nfc"\s+android:required="false"/);
    expect(lib).not.toMatch(/intent-filter|<service|<receiver|<activity/);
  });

  test('if the Android project is generated, its manifest has no NFC intent filter', () => {
    const manifest = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    if (!fs.existsSync(manifest)) return;
    const text = fs.readFileSync(manifest, 'utf8');
    expect(text).not.toMatch(/android\.nfc\.action\.(TECH|TAG|NDEF)_DISCOVERED/);
  });
});
