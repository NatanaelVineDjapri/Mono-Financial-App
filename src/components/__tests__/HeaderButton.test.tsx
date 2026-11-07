import { fireEvent, render } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';

import { MonoColors } from '@/theme/tokens';
import { HeaderButton } from '../HeaderButton';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe('HeaderButton', () => {
  test('icon-only: a 40×40 square, radius 10, card fill, 1px border', async () => {
    const result = await render(<HeaderButton icon="pencil" label="Edit monthly limit" onPress={jest.fn()} testID="btn" />);
    const style = flat(result.getByTestId('btn').props.style);
    expect(style).toMatchObject({
      width: 40,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: MonoColors.border,
      backgroundColor: MonoColors.card,
    });
    expect(result.getByRole('button', { name: 'Edit monthly limit' })).toBeTruthy();
  });

  test('with text: a chip at least 40 high, padding 14, text 14/400 then the icon 8 apart, free to widen', async () => {
    const result = await render(<HeaderButton icon="chevron-down" text="Oct 2026" label="Month: October 2026. Change month" testID="chip" />);
    const style = flat(result.getByTestId('chip').props.style);
    expect(style).toMatchObject({ minHeight: 40, paddingHorizontal: 14, gap: 8, flexDirection: 'row', borderRadius: 10, backgroundColor: MonoColors.card });
    expect(style.width).toBeUndefined();
    expect(style.height).toBeUndefined();

    const text = result.getByText('Oct 2026');
    expect(flat(text.props.style)).toMatchObject({ fontSize: 14, fontFamily: 'IBMPlexSans_400Regular', color: MonoColors.text });
    expect(text.props.numberOfLines).toBeUndefined();
  });

  test('icon is 20px', async () => {
    const result = await render(<HeaderButton icon="filter" label="Filters" testID="btn" />);
    expect(result.getByTestId('btn-icon', { includeHiddenElements: true }).props.width).toBe(20);
  });

  test('badge shows the count and stays out of the accessibility tree', async () => {
    const result = await render(<HeaderButton icon="filter" label="Filters, 2 active" badge="2" />);
    expect(result.getByText('2', { includeHiddenElements: true })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Filters, 2 active' })).toBeTruthy();
  });

  test('press calls onPress; disabled does not and says so', async () => {
    const onPress = jest.fn();
    const enabled = await render(<HeaderButton icon="pencil" label="Edit" onPress={onPress} />);
    await fireEvent.press(enabled.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);

    const disabledPress = jest.fn();
    const disabled = await render(<HeaderButton icon="pencil" label="Edit" onPress={disabledPress} disabled />);
    expect(disabled.getByRole('button').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(disabled.getByRole('button'));
    expect(disabledPress).not.toHaveBeenCalled();
  });

  test('no hex colour literals in the file', () => {
    const source = fs.readFileSync(path.join(__dirname, '../HeaderButton.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
