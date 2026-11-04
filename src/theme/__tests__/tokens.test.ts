import { amountColor, MonoColors } from '../tokens';

describe('amountColor', () => {
  test('income is positive (green)', () => {
    expect(amountColor('income')).toBe(MonoColors.positive);
  });

  test('expense is negative (red)', () => {
    expect(amountColor('expense')).toBe(MonoColors.negative);
  });

  test('transfer is neutral, never coloured', () => {
    expect(amountColor('transfer')).toBe(MonoColors.textSecond);
  });
});
