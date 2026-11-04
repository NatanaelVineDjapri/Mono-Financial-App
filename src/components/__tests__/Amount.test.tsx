import { act, render } from '@testing-library/react-native';

import { Amount } from '../Amount';
import { useHideAmounts } from '../hide-amounts-store';
import { MonoColors } from '@/theme/tokens';

beforeEach(() => {
  useHideAmounts.getState().setHidden(false);
});

describe('Amount', () => {
  test('formats a plain rupiah amount', async () => {
    const result = await render(<Amount value={1250000} />);
    expect(result.getByText('Rp1.250.000')).toBeTruthy();
  });

  test('a negative value gets a true minus sign', async () => {
    const result = await render(<Amount value={-38500} />);
    expect(result.getByText('−Rp38.500')).toBeTruthy();
  });

  test('sign=true adds a leading plus on a positive value', async () => {
    const result = await render(<Amount value={7000000} sign />);
    expect(result.getByText('+Rp7.000.000')).toBeTruthy();
  });

  test('a foreign-currency amount uses money()', async () => {
    const result = await render(<Amount value={25000} currency="USD" minorFactor={100} />);
    expect(result.getByText('US$250,00')).toBeTruthy();
  });

  test('hidden mode never leaks the real number', async () => {
    useHideAmounts.getState().setHidden(true);
    const result = await render(<Amount value={1250000} />);
    expect(result.queryByText('Rp1.250.000')).toBeNull();
    expect(result.getByText('Rp••••••••')).toBeTruthy();
  });

  test('re-renders when hide-amounts toggles (store is reactive)', async () => {
    const result = await render(<Amount value={1250000} />);
    expect(result.getByText('Rp1.250.000')).toBeTruthy();

    await act(async () => {
      useHideAmounts.getState().toggle();
    });
    expect(result.queryByText('Rp1.250.000')).toBeNull();
  });

  test('colour follows meaning: income is positive (green)', async () => {
    const result = await render(<Amount value={7000000} kind="income" />);
    expect(result.getByText('Rp7.000.000').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: MonoColors.positive })]));
  });

  test('colour follows meaning: expense is negative (red)', async () => {
    const result = await render(<Amount value={-38500} kind="expense" />);
    expect(result.getByText('−Rp38.500').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: MonoColors.negative })]));
  });

  test('a transfer is never coloured: textSecond, not positive or negative', async () => {
    const result = await render(<Amount value={1000000} kind="transfer" />);
    const style = result.getByText('Rp1.000.000').props.style;
    expect(style).toEqual(expect.arrayContaining([expect.objectContaining({ color: MonoColors.textSecond })]));
    expect(style).not.toEqual(expect.arrayContaining([expect.objectContaining({ color: MonoColors.positive })]));
    expect(style).not.toEqual(expect.arrayContaining([expect.objectContaining({ color: MonoColors.negative })]));
  });

  test('no kind at all defaults to plain text colour, not a signal colour', async () => {
    const result = await render(<Amount value={1000000} />);
    const style = result.getByText('Rp1.000.000').props.style;
    expect(style).toEqual(expect.arrayContaining([expect.objectContaining({ color: MonoColors.text })]));
  });

  test('never truncates: no numberOfLines is set, so 200% text scale can wrap', async () => {
    const result = await render(<Amount value={1250000} />);
    expect(result.getByText('Rp1.250.000').props.numberOfLines).toBeUndefined();
  });
});
