import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AvatarPickerSheet } from '../AvatarPickerSheet';
import { ProfileAvatar } from '../ProfileAvatar';

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const onSelect = jest.fn();
const onClose = jest.fn();

async function open(selected: Parameters<typeof AvatarPickerSheet>[0]['selected'] = null) {
  return await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AvatarPickerSheet visible selected={selected} onSelect={onSelect} onClose={onClose} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

test('the default and the nine poses, each a labelled radio', async () => {
  await open();
  expect(screen.getByText('Pilih foto profil')).toBeTruthy();
  expect(screen.getAllByRole('radio')).toHaveLength(10);
  for (const label of ['Bawaan', 'Kacamata hitam', 'Kacamata', 'Mata duitan', 'Headphone', 'Berpikir', 'Cek portofolio', 'Jempol', 'Menabung', 'Pakai hoodie']) {
    expect(screen.getByRole('radio', { name: label })).toBeTruthy();
  }
});

test('the chosen one is selected and carries a check mark; nobody else does', async () => {
  await open('thumbs_up');
  expect(screen.getByTestId('avatar-option-thumbs_up').props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId('avatar-option-thumbs_up-check')).toBeTruthy();
  expect(screen.getByTestId('avatar-option-default').props.accessibilityState.selected).toBe(false);
  expect(screen.queryByTestId('avatar-option-sunglasses-check')).toBeNull();
});

test('with nothing chosen the default is the selected one', async () => {
  await open(null);
  expect(screen.getByTestId('avatar-option-default').props.accessibilityState.selected).toBe(true);
});

test('tapping a pose chooses it; tapping the default chooses none', async () => {
  await open();
  await fireEvent.press(screen.getByTestId('avatar-option-money_eyes'));
  expect(onSelect).toHaveBeenLastCalledWith('money_eyes');
  await fireEvent.press(screen.getByTestId('avatar-option-default'));
  expect(onSelect).toHaveBeenLastCalledWith(null);
});

describe('ProfileAvatar', () => {
  test('a chosen pose draws its picture, cropped round and hidden from screen readers', async () => {
    await render(<ProfileAvatar poseId="sunglasses" size={40} testID="av" />);
    const disc = screen.getByTestId('av', { includeHiddenElements: true });
    expect(disc.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.getByTestId('av-image', { includeHiddenElements: true })).toBeTruthy();
  });

  test('no pose draws the default fox head instead, not an empty circle', async () => {
    await render(<ProfileAvatar poseId={null} size={40} testID="av" />);
    expect(screen.getByTestId('av', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('av-image', { includeHiddenElements: true })).toBeNull();
  });
});
