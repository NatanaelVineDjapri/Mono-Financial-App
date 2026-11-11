import * as en from '../en';
import * as id from '../id';
import * as app from '../index';
import { DEFAULT_LANGUAGE, getLanguage, initialLanguage, isLanguage, LANGUAGE_CHOICE_ENABLED, useLanguage } from '../lang';

type Fn = (...args: never[]) => unknown;
const functionNames = (m: object) =>
  Object.keys(m)
    .filter(k => typeof (m as Record<string, unknown>)[k] === 'function')
    .sort();
const fnOf = (m: object, name: string) => (m as Record<string, Fn>)[name];

describe('the two dictionaries stay in step', () => {
  test('en.ts and id.ts export exactly the same functions, with the same number of parameters', () => {
    const ids = functionNames(id);
    expect(functionNames(en)).toEqual(ids);
    for (const name of ids) {
      expect([name, fnOf(en, name).length]).toEqual([name, fnOf(id, name).length]);
    }
    expect(ids.length).toBeGreaterThan(500);
  });

  test('index.ts re-exports every one of them, so nothing can be imported in one language only', () => {
    expect(functionNames(app)).toEqual(functionNames(id));
  });

  test('the shared constants are the same in both', () => {
    expect(en.TRANSFER_IN_FIRST_LINK).toBe(id.TRANSFER_IN_FIRST_LINK);
  });
});

describe('the English dictionary is English', () => {
  // Every zero-argument sentence, read in English: none of these words belongs to an English sentence.
  const INDONESIAN =
    /\b(kamu|tidak|yang|untuk|belum|simpan|batal|hapus|akun|catat|pengeluaran|pemasukan|cadangan|pengaturan|dengan|atau|sudah|bisa|nominal|saldo|kunci|tersimpan|jatuh tempo|selamat|datang|terima|kasih|halo|silakan|mohon|maaf)\b/i;

  test('no Indonesian word is left in any of its sentences', () => {
    const offenders: string[] = [];
    for (const name of functionNames(en)) {
      const fn = fnOf(en, name) as () => unknown;
      if (fn.length !== 0) continue;
      const text = JSON.stringify(fn());
      if (INDONESIAN.test(text)) offenders.push(`${name}: ${text}`);
    }
    expect(offenders).toEqual([]);
  });

  test('not one string literal in en.ts holds an Indonesian word, arguments or not', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript') as typeof import('typescript');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'en.ts'), 'utf8') as string;
    const file = ts.createSourceFile('en.ts', source, ts.ScriptTarget.Latest, true);
    const offenders: string[] = [];
    const visit = (node: import('typescript').Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        if (INDONESIAN.test(node.text)) offenders.push(`line ${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${node.text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    expect(offenders).toEqual([]);
  });

  test('sentences with arguments are English too', () => {
    expect(en.aiMsgSaved('expense', 'GoPay', 'Rp287.500')).toBe('Expense saved. GoPay is now Rp287.500.');
    expect(en.aiMsgBlockedShortfall('Rp1.050.000')).toBe('Short by Rp1.050.000. Change the account, lower the amount, or move money in first.');
    expect(en.aiMsgCheckAmount('40k', 'Rp40.000', 'Rp4.000')).toBe('Check the amount. You typed “40k” (Rp40.000), the draft says Rp4.000.');
    expect(en.moreRecurringSub(1)).toBe('Gym, internet, subscriptions · 1 due');
    expect(en.moreFooterLine('1.0.0')).toBe('Version 1.0.0 · Works offline · No account, no sync');
    expect(en.aiEditProgress(1, 2)).toBe('1 of 2');
    expect(en.aiChatOpening('Nael')).toMatch(/^Hi Nael! /);
    expect(en.aiChatOpening('')).toMatch(/^Hi! /);
    expect(en.welcomeGreeting('Nael', 'morning')).toBe('Good morning, Nael');
    expect(en.welcomeGreeting('Nael', 'afternoon')).toBe('Good afternoon, Nael');
    expect(en.welcomeGreeting('Nael', 'late_afternoon')).toBe('Good afternoon, Nael');
    expect(en.welcomeGreeting('Nael', 'evening')).toBe('Good evening, Nael');
    expect(en.welcomeGreeting('Nael', 'checkin')).toBe('How are you, Nael?');
    expect(en.welcomeGreeting(null, 'morning')).toBe('Good morning');
    expect(en.welcomeGreeting(null, 'checkin')).toBe('How are you?');
    expect(id.welcomeGreeting('Nael', 'morning')).toBe('Selamat pagi, Nael');
    expect(id.welcomeGreeting('Nael', 'afternoon')).toBe('Selamat siang, Nael');
    expect(id.welcomeGreeting('Nael', 'late_afternoon')).toBe('Selamat sore, Nael');
    expect(id.welcomeGreeting('Nael', 'evening')).toBe('Selamat malam, Nael');
    expect(id.welcomeGreeting('Nael', 'checkin')).toBe('Apa kabar, Nael?');
  });
});

describe('the language picker', () => {
  afterEach(() => useLanguage.setState({ language: 'id' })); // the test setup's own language

  test('English is the default of the app', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  test('every call reads the current language, so a screen drawn again shows the new one', () => {
    useLanguage.setState({ language: 'en' });
    expect(app.moreGroupMoney()).toBe('MONEY');
    expect(app.aiMsgError('no_internet').title).toBe('No internet.');
    useLanguage.setState({ language: 'id' });
    expect(app.moreGroupMoney()).toBe('UANG');
    expect(app.aiMsgError('no_internet').title).toBe('Tidak ada internet.');
    useLanguage.getState().setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(app.moreGroupMoney()).toBe('MONEY');
  });

  test('sentences that were English from the start are the same in both languages', () => {
    useLanguage.setState({ language: 'en' });
    const english = app.couldNotSaveMessage();
    useLanguage.setState({ language: 'id' });
    expect(app.couldNotSaveMessage()).toBe(english);
  });

  test('while the language choice is off, the app starts in English whatever was saved', () => {
    expect(LANGUAGE_CHOICE_ENABLED).toBe(false);
    expect(initialLanguage('id')).toBe('en');
    expect(initialLanguage('en')).toBe('en');
    expect(initialLanguage(null)).toBe('en');
    expect(initialLanguage('fr')).toBe('en');
  });

  test('only "en" and "id" are languages', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('id')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});
