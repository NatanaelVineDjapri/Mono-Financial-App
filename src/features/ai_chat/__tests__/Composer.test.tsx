import { fireEvent, render } from '@testing-library/react-native';

import { MAX_CHARS } from '../config';
import { Composer, COUNTER_FROM, canSend, type ComposerProps } from '../ui/Composer';

function props(overrides: Partial<ComposerProps> = {}): ComposerProps {
  return {
    value: '',
    onChange: jest.fn(),
    onSend: jest.fn(),
    processing: false,
    suggestions: ['Beli bensin 40rb', 'Transfer 500rb BCA ke Jago'],
    onPickSuggestion: jest.fn(),
    ...overrides,
  };
}

const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true;
const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('canSend', () => {
  test('off when empty or blank, over the limit, or while a request is running', () => {
    expect(canSend('', false)).toBe(false);
    expect(canSend('   \n', false)).toBe(false);
    expect(canSend('kopi 25rb', false)).toBe(true);
    expect(canSend('a'.repeat(MAX_CHARS), false)).toBe(true);
    expect(canSend('a'.repeat(MAX_CHARS + 1), false)).toBe(false);
    expect(canSend('kopi 25rb', true)).toBe(false);
  });
});

describe('Composer', () => {
  test('the send button is disabled when the box is empty, and sends nothing', async () => {
    const p = props();
    const result = await render(<Composer {...p} />);
    expect(disabled(result.getByRole('button', { name: 'Kirim' }))).toBe(true);
    await fireEvent.press(result.getByRole('button', { name: 'Kirim' }));
    expect(p.onSend).not.toHaveBeenCalled();
  });

  test('with text it sends; while processing it is disabled and the text stays in the box', async () => {
    const p = props({ value: 'kopi 25rb pake gopay' });
    const ready = await render(<Composer {...p} />);
    expect(disabled(ready.getByRole('button', { name: 'Kirim' }))).toBe(false);
    await fireEvent.press(ready.getByRole('button', { name: 'Kirim' }));
    expect(p.onSend).toHaveBeenCalledTimes(1);

    const busy = props({ value: 'kopi 25rb pake gopay', processing: true });
    const result = await render(<Composer {...busy} />);
    expect(disabled(result.getByRole('button', { name: 'Kirim' }))).toBe(true);
    expect(result.getByTestId('chat-input').props.value).toBe('kopi 25rb pake gopay');
    await fireEvent.press(result.getByRole('button', { name: 'Kirim' }));
    expect(busy.onSend).not.toHaveBeenCalled();
  });

  test('over the limit the button is disabled too (the box itself stops at 500)', async () => {
    const p = props({ value: 'a'.repeat(MAX_CHARS + 1) });
    const result = await render(<Composer {...p} />);
    expect(disabled(result.getByRole('button', { name: 'Kirim' }))).toBe(true);
    expect(result.getByTestId('chat-input').props.maxLength).toBe(MAX_CHARS);
  });

  test('the box is 48 high, radius 16, multiline, and shows no counter up to 400 characters', async () => {
    const result = await render(<Composer {...props({ value: 'a'.repeat(COUNTER_FROM) })} />);
    const input = result.getByTestId('chat-input');
    expect(input.props.multiline).toBe(true);
    expect(flat(input.props.style)).toMatchObject({ minHeight: 48, borderRadius: 16 });
    expect(result.queryByTestId('char-counter')).toBeNull();
  });

  test('the counter "412/500" appears above 400', async () => {
    const result = await render(<Composer {...props({ value: 'a'.repeat(412) })} />);
    expect(result.getByText('412/500')).toBeTruthy();
    expect(result.getByTestId('char-counter').props.accessibilityLiveRegion).toBe('polite');
  });

  test('a suggestion only fills the box: it never sends', async () => {
    const p = props();
    const result = await render(<Composer {...p} />);
    await fireEvent.press(result.getByRole('button', { name: 'Beli bensin 40rb' }));
    expect(p.onPickSuggestion).toHaveBeenCalledWith('Beli bensin 40rb');
    expect(p.onSend).not.toHaveBeenCalled();
  });

  test('typing calls onChange; the standing note is shown', async () => {
    const p = props();
    const result = await render(<Composer {...p} />);
    await fireEvent.changeText(result.getByTestId('chat-input'), 'kopi');
    expect(p.onChange).toHaveBeenCalledWith('kopi');
    expect(result.getByText('AI bisa salah. Selalu cek draf sebelum menyimpan.')).toBeTruthy();
  });

  test('the send button is a 48 square', async () => {
    const result = await render(<Composer {...props({ value: 'x' })} />);
    expect(flat(result.getByTestId('chat-send').props.style)).toMatchObject({ width: 48, height: 48 });
  });
});
