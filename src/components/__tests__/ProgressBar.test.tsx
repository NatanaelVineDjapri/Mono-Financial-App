import { act, render } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';

import { ProgressBar } from '../ProgressBar';
import { useHideAmounts } from '../hide-amounts-store';

describe('ProgressBar', () => {
  afterEach(async () => await act(() => useHideAmounts.getState().setHidden(false)));

  test('0 bp: empty bar, no overflow segment, no over row', async () => {
    const result = await render(<ProgressBar valueBp={0} label="Belanja" testID="bar" />);
    const bar = result.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 0 });
    expect(result.queryByText(/Over/)).toBeNull();
  });

  test('5000 bp: half filled, no overflow', async () => {
    const result = await render(<ProgressBar valueBp={5000} label="Belanja" testID="bar" />);
    const bar = result.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ now: 50 });
    expect(result.queryByText(/Over/)).toBeNull();
  });

  test('10000 bp: fully filled, still no overflow segment', async () => {
    const result = await render(<ProgressBar valueBp={10000} label="Belanja" testID="bar" />);
    const bar = result.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ now: 100 });
    expect(result.queryByText(/Over/)).toBeNull();
  });

  test('capAtFull (a goal past its target): full in the accent colour, no overflow, no "over" row, real percentage in the label', async () => {
    const result = await render(<ProgressBar valueBp={36743_83} label="Total assets" overAmount={11000000000} capAtFull testID="bar" />);
    expect(result.queryByTestId('bar-overflow')).toBeNull();
    expect(result.queryByText(/Over|Lebih/)).toBeNull();
    const bar = result.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ now: 100 });
    expect(bar.props.accessibilityLabel).toBe('Total assets, 36743,83% used');
    const fill = Object.assign({}, ...[result.getByTestId('bar-fill').props.style].flat(Infinity).filter(Boolean));
    expect(fill.width).toBe('100%');
  });

  test('11600 bp with overAmount: overflow segment, over row and full label appear', async () => {
    const result = await render(<ProgressBar valueBp={11600} label="Belanja" overAmount={112000} testID="bar" />);
    const bar = result.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 116 });
    expect(bar.props.accessibilityLabel).toBe('Belanja, 116,00% used, over by Rp112.000');
    expect(result.getByText('Over by Rp112.000')).toBeTruthy();
  });

  test('accessibilityLabel replaces the generated label', async () => {
    const result = await render(
      <ProgressBar valueBp={9583} label="Bills" accessibilityLabel="Bills: Rp1.150.000 spent of Rp1.200.000 limit, 95,83% used, Rp50.000 left" />,
    );
    expect(result.getByRole('progressbar').props.accessibilityLabel).toBe('Bills: Rp1.150.000 spent of Rp1.200.000 limit, 95,83% used, Rp50.000 left');
  });

  test('over limit but no overAmount given: no over row (documented caller responsibility)', async () => {
    const result = await render(<ProgressBar valueBp={11600} label="Belanja" testID="bar" />);
    expect(result.queryByText(/Over/)).toBeNull();
  });

  test('hidden mode: the over row never leaks the nominal', async () => {
    await act(() => useHideAmounts.getState().setHidden(true));
    const result = await render(<ProgressBar valueBp={11600} label="Belanja" overAmount={112000} testID="bar" />);
    expect(result.queryByText('Over by Rp112.000')).toBeNull();
    expect(result.getByText('Over by Rp••••••••')).toBeTruthy();
    const bar = result.getByRole('progressbar');
    expect(bar.props.accessibilityLabel).toBe('Belanja, 116,00% used, over by Rp••••••••');
  });

  test('no hex colour literals in the file', () => {
    const source = fs.readFileSync(path.join(__dirname, '../ProgressBar.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
