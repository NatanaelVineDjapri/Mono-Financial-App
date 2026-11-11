import { MAX_TRANSACTIONS } from '../config';
import { parseAiResponse, RESPONSE_JSON_SCHEMA } from '../schema';
import { replyText } from './fixtures';

const kopi = { type: 'expense', amount: 25000, amount_text: '25rb', description: 'Kopi', category: 'Food & drink', account: 'GoPay' } as const;

describe('parseAiResponse', () => {
  test('accepts a well-formed reply; a field the model leaves out is null', () => {
    const parsed = parseAiResponse(replyText('create_transactions', [kopi]));
    expect(parsed?.intent).toBe('create_transactions');
    expect(parsed?.transactions[0]).toMatchObject({ amount: 25000, to_account: null, date: null, relative_date: null });

    const sparse = JSON.stringify({ intent: 'create_transactions', transactions: [{ type: 'expense', amount: 5000, description: 'Parkir' }], missing: [], reason: null });
    expect(parseAiResponse(sparse)?.transactions[0].account).toBeNull();
  });

  test('rejects an unknown field, at the top and inside a transaction', () => {
    const top = { ...JSON.parse(replyText('create_transactions', [kopi])), answer: 'Halo!' };
    expect(parseAiResponse(JSON.stringify(top))).toBeNull();
    const inner = JSON.parse(replyText('create_transactions', [kopi]));
    inner.transactions[0].comment = 'enak';
    expect(parseAiResponse(JSON.stringify(inner))).toBeNull();
  });

  test('rejects wrong types, an unknown intent, a non-integer or non-positive amount, a bad date', () => {
    for (const bad of [{ amount: '25000' }, { amount: 25.5 }, { amount: 0 }, { amount: -5 }, { type: 'refund' }, { date: '2026-02-30' }, { date: 'kemarin' }, { relative_date: 'tomorrow' }]) {
      expect(parseAiResponse(replyText('create_transactions', [{ ...kopi, ...bad } as never]))).toBeNull();
    }
    expect(parseAiResponse(JSON.stringify({ intent: 'chat', transactions: [], missing: [], reason: null }))).toBeNull();
    expect(parseAiResponse('bukan json')).toBeNull();
    expect(parseAiResponse('"halo"')).toBeNull();
  });

  test('rejects more than the maximum number of transactions, accepts exactly the maximum', () => {
    expect(parseAiResponse(replyText('create_transactions', Array(MAX_TRANSACTIONS).fill(kopi)))).not.toBeNull();
    expect(parseAiResponse(replyText('create_transactions', Array(MAX_TRANSACTIONS + 1).fill(kopi)))).toBeNull();
  });

  test('out_of_scope with transactions is rejected; without them it is fine', () => {
    expect(parseAiResponse(replyText('out_of_scope', [kopi], { reason: 'question' }))).toBeNull();
    expect(parseAiResponse(replyText('out_of_scope', [], { reason: 'advice' }))?.reason).toBe('advice');
    expect(parseAiResponse(replyText('out_of_scope', []))?.reason).toBeNull();
  });

  test('create_transactions and clarify need a transaction; only clarify may have a null type', () => {
    expect(parseAiResponse(replyText('create_transactions', []))).toBeNull();
    expect(parseAiResponse(replyText('clarify', []))).toBeNull();
    expect(parseAiResponse(replyText('create_transactions', [{ ...kopi, type: null }]))).toBeNull();
    expect(parseAiResponse(replyText('clarify', [{ ...kopi, type: null }], { missing: ['type'] }))).not.toBeNull();
  });
});

describe('RESPONSE_JSON_SCHEMA', () => {
  test('asks for exactly the fields the zod schema accepts, all required, nothing extra', () => {
    const item = RESPONSE_JSON_SCHEMA.properties.transactions.items;
    expect(Object.keys(item.properties).sort()).toEqual([...item.required].sort());
    expect(item.additionalProperties).toBe(false);
    expect(Object.keys(RESPONSE_JSON_SCHEMA.properties).sort()).toEqual(['intent', 'missing', 'reason', 'transactions']);
    expect(RESPONSE_JSON_SCHEMA.properties.intent.enum).toEqual(['create_transactions', 'clarify', 'out_of_scope']);
    expect(RESPONSE_JSON_SCHEMA.properties.transactions.maxItems).toBe(MAX_TRANSACTIONS);
  });
});
