// Static check: notifications feature must not use push tokens, fetch, or AI modules.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      results.push(...collectFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const DIRS = [
  join(__dirname, '../../../../features/notifications'),
  join(__dirname, '../../'),  // domain/notify
];

const files = DIRS.flatMap(d => { try { return collectFiles(d); } catch { return []; } })
  .filter(f => !f.includes('__tests__'));

describe('notifications static checks', () => {
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    test(`${file.replace(/.*src[\\/]/, '')}: no getExpoPushTokenAsync`, () => {
      expect(content).not.toContain('getExpoPushTokenAsync');
    });
    test(`${file.replace(/.*src[\\/]/, '')}: no bare fetch(`, () => {
      // Allow 'fetch' in comments or strings mentioning it, but not actual calls
      expect(content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\bfetch\s*\(/);
    });
    test(`${file.replace(/.*src[\\/]/, '')}: no ai_chat imports`, () => {
      expect(content).not.toContain("from '@/features/ai_chat");
    });
  }
});
