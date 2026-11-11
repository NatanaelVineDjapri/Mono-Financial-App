// The only shape the model may answer in (CLAUDE.md rule 9). Two forms of the same contract:
// `responseJsonSchema` is what Gemini is asked to produce (structured output), and the zod
// schema is what we check the reply against, strictly: an unknown field, a wrong type, more
// than MAX_TRANSACTIONS transactions, or a transaction under `out_of_scope` all make the reply
// "unreadable". There is no free-text field to answer the user in.
import { z } from 'zod';

import { addDays } from '../../core/date';
import { MAX_TRANSACTIONS } from './config';

export const INTENTS = ['create_transactions', 'clarify', 'out_of_scope'] as const;
export const TX_TYPES = ['expense', 'income', 'transfer'] as const;
export const RELATIVE_DATES = ['today', 'yesterday', 'day_before_yesterday'] as const;
export const MISSING_FIELDS = ['type', 'amount', 'account', 'category', 'to_account'] as const;
export const REASONS = ['question', 'advice', 'data_lookup', 'override', 'other'] as const;

export type Intent = (typeof INTENTS)[number];
export type AiTxType = (typeof TX_TYPES)[number];
export type RelativeDate = (typeof RELATIVE_DATES)[number];
export type MissingField = (typeof MISSING_FIELDS)[number];
export type OutOfScopeReason = (typeof REASONS)[number];

// A field the model may leave out is the same as null.
const nullableString = z
  .string()
  .nullish()
  .transform(v => v ?? null);

const isRealDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

const TransactionSchema = z.strictObject({
  type: z.enum(TX_TYPES).nullish().transform(v => v ?? null),
  amount: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform(v => v ?? null),
  amount_text: nullableString,
  description: z.string().max(200),
  category: nullableString,
  account: nullableString,
  to_account: nullableString,
  date: z
    .string()
    .refine(isRealDate)
    .nullish()
    .transform(v => v ?? null),
  relative_date: z.enum(RELATIVE_DATES).nullish().transform(v => v ?? null),
  note: nullableString,
});

export const AiResponseSchema = z
  .strictObject({
    intent: z.enum(INTENTS),
    transactions: z.array(TransactionSchema).max(MAX_TRANSACTIONS),
    missing: z.array(z.enum(MISSING_FIELDS)).default([]),
    reason: z.enum(REASONS).nullish().transform(v => v ?? null),
  })
  .superRefine((value, ctx) => {
    if (value.intent === 'out_of_scope' && value.transactions.length > 0) {
      ctx.addIssue({ code: 'custom', message: 'out_of_scope carries no transactions' });
    }
    if (value.intent !== 'out_of_scope' && value.transactions.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'a transaction is expected' });
    }
    if (value.intent === 'create_transactions' && value.transactions.some(t => t.type == null)) {
      ctx.addIssue({ code: 'custom', message: 'type may be null only when clarifying' });
    }
  });

export type AiTransaction = z.infer<typeof AiResponseSchema>['transactions'][number];
export type AiResponse = z.infer<typeof AiResponseSchema>;

// Parses the model's text. Returns null for anything that is not valid JSON in this shape.
export function parseAiResponse(text: string): AiResponse | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const result = AiResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type: [type, 'null'], ...extra });

// `generationConfig.responseJsonSchema` (JSON Schema, lowercase types; a type array with "null"
// marks a nullable field). Every key is required so the model always answers every field.
export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: [...INTENTS] },
    transactions: {
      type: 'array',
      maxItems: MAX_TRANSACTIONS,
      items: {
        type: 'object',
        properties: {
          type: { type: ['string', 'null'], enum: [...TX_TYPES, null] },
          amount: nullable('integer'),
          amount_text: nullable('string'),
          description: { type: 'string' },
          category: nullable('string'),
          account: nullable('string'),
          to_account: nullable('string'),
          date: nullable('string'),
          relative_date: { type: ['string', 'null'], enum: [...RELATIVE_DATES, null] },
          note: nullable('string'),
        },
        required: ['type', 'amount', 'amount_text', 'description', 'category', 'account', 'to_account', 'date', 'relative_date', 'note'],
        additionalProperties: false,
      },
    },
    missing: { type: 'array', items: { type: 'string', enum: [...MISSING_FIELDS] } },
    reason: { type: ['string', 'null'], enum: [...REASONS, null] },
  },
  required: ['intent', 'transactions', 'missing', 'reason'],
  additionalProperties: false,
} as const;
