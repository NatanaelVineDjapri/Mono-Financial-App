// Offline-first (CLAUDE.md rule 8): only src/features/ai_chat and src/features/fx may
// call the network. This runs the real ESLint CLI (as a child process — ESLint 9's flat
// config loader uses a dynamic import() that Jest's CJS module system can't satisfy in
// -process) against the whole src tree, so a stray fetch() anywhere else fails the test
// suite, not just a lint pass someone forgot to run.
import { execFileSync } from 'child_process';
import * as path from 'path';

test('no fetch() call exists outside src/features/ai_chat or src/features/fx', () => {
  const root = path.join(__dirname, '../..');
  const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');

  let stdout: string;
  try {
    stdout = execFileSync(process.execPath, [eslintBin, 'src', '--format', 'json'], { cwd: root, encoding: 'utf8' });
  } catch (err) {
    // eslint exits non-zero when it finds any lint error at all (not just ours) — the
    // JSON report is still on stdout.
    stdout = (err as { stdout?: string }).stdout ?? '';
  }

  type LintMessage = { ruleId: string | null; message: string; line: number };
  type LintResult = { filePath: string; messages: LintMessage[] };
  const results: LintResult[] = JSON.parse(stdout);

  const fetchViolations = results.flatMap(r =>
    r.messages
      .filter(m => m.ruleId === 'no-restricted-globals' && /fetch/.test(m.message))
      .map(m => `${r.filePath}:${m.line} - ${m.message}`),
  );

  expect(fetchViolations).toEqual([]);
}, 30000);
