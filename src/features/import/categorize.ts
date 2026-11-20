// A category for a detected transaction (docs/IMPORT_PLAN.md, section 6): first the person's own memory for that
// merchant ("Ingat kategori untuk ..."), then a small list of keywords, otherwise EMPTY. Never a guess beyond that
// and never AI. Pure. A category is only offered when it is one of the person's own active categories of the right
// kind (the rules name the app's starter categories; a renamed or archived one simply offers nothing).
export interface CategoryLite {
  id: number;
  name: string;
  kind: 'income' | 'expense';
  archived?: boolean | number;
}

// The merchant as a stable key: lower case, letters and digits only, single spaces.
export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Rule {
  category: string;
  kind: 'income' | 'expense';
  words: readonly string[];
}

export const KEYWORD_RULES: readonly Rule[] = [
  { category: 'Food & drink', kind: 'expense', words: ['kopi', 'coffee', 'cafe', 'resto', 'restoran', 'warung', 'bakso', 'nasi', 'mie', 'bakmi', 'ayam', 'sate', 'pizza', 'burger', 'kfc', 'mcd', 'mcdonalds', 'starbucks', 'janji jiwa', 'kenangan', 'roti', 'bakery', 'makan', 'gofood', 'grabfood', 'shopeefood', 'food'] },
  { category: 'Transport', kind: 'expense', words: ['gojek', 'gocar', 'goride', 'grab', 'grabcar', 'transjakarta', 'krl', 'mrt', 'lrt', 'kai', 'tol', 'parkir', 'bensin', 'pertamina', 'spbu', 'shell', 'ojek', 'taksi', 'blue bird', 'bluebird', 'kereta', 'damri'] },
  { category: 'Bills', kind: 'expense', words: ['pln', 'listrik', 'token', 'pdam', 'indihome', 'telkom', 'telkomsel', 'indosat', 'smartfren', 'internet', 'wifi', 'bpjs', 'pulsa', 'paket data', 'asuransi'] },
  { category: 'Health', kind: 'expense', words: ['apotek', 'apotik', 'farmasi', 'kimia farma', 'klinik', 'rumah sakit', 'dokter', 'halodoc', 'k24'] },
  { category: 'Shopping', kind: 'expense', words: ['tokopedia', 'shopee', 'lazada', 'bukalapak', 'blibli', 'zalora', 'uniqlo', 'toko', 'indomaret', 'alfamart', 'alfamidi', 'supermarket', 'hypermart', 'matahari'] },
  { category: 'Leisure', kind: 'expense', words: ['netflix', 'spotify', 'youtube', 'disney', 'bioskop', 'cinema', 'xxi', 'cgv', 'steam', 'konser', 'tiket'] },
  { category: 'Salary', kind: 'income', words: ['gaji', 'salary', 'payroll'] },
  { category: 'Interest and dividends', kind: 'income', words: ['bunga', 'dividen', 'dividend', 'interest'] },
];

function hasWord(key: string, word: string): boolean {
  return ` ${key} `.includes(` ${word} `);
}

function usable(c: CategoryLite | undefined, kind: 'income' | 'expense'): c is CategoryLite {
  return !!c && c.kind === kind && !c.archived;
}

export interface SuggestInput {
  merchant: string;
  kind: 'income' | 'expense' | null;
  categories: readonly CategoryLite[];
  remembered: number | null; // the category the person last chose for this merchant, if any
}

// The id of the suggested category, or null (the card then says "Pilih kategori"). With the kind not yet
// chosen ("Perlu dicek") nothing is suggested.
export function suggestCategory({ merchant, kind, categories, remembered }: SuggestInput): number | null {
  if (kind === null) return null;
  const memory = categories.find(c => c.id === remembered);
  if (usable(memory, kind)) return memory.id;

  const key = merchantKey(merchant);
  if (!key) return null;
  for (const rule of KEYWORD_RULES) {
    if (rule.kind !== kind) continue;
    if (!rule.words.some(w => hasWord(key, w))) continue;
    const category = categories.find(c => c.name === rule.category && c.kind === kind);
    if (usable(category, kind)) return category.id;
  }
  return null;
}
