// The entrance: a figure starts low and ends on its exact value; outside the entrance it is simply there.
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CountUpAmount, Reveal, Rise, TabEntrance } from '../Intro';
import { markAppReady, resetAppReady } from '@/core/appReady';
import { armIntro, INTRO_MS, resetIntro, tabHasEntered, useIntro } from '@/core/intro';

const mockFocus = jest.fn();
jest.mock('expo-router', () => ({
  DarkTheme: { colors: {} },
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    React.useEffect(() => {
      mockFocus();
      effect();
    }, [effect]);
  },
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockFocus.mockClear();
  resetAppReady();
  resetIntro();
});
afterEach(() => jest.useRealTimers());

test('without an app launch the value is shown at once', async () => {
  const view = await render(<CountUpAmount value={8880000} />);
  expect(view.getByText('Rp8.880.000')).toBeTruthy();
});

test('on launch it counts up after the splash lifts and ends exactly on the value; the entrance then ends', async () => {
  armIntro();
  const view = await render(
    <Reveal order={0}>
      <Text>block</Text>
      <CountUpAmount value={8880000} />
    </Reveal>,
  );
  expect(view.getByText('block')).toBeTruthy();
  expect(view.getByText('Rp0')).toBeTruthy();
  await act(async () => markAppReady());
  await act(async () => jest.advanceTimersByTime(600));
  expect(view.queryByText('Rp0')).toBeNull();
  expect(view.queryByText('Rp8.880.000')).toBeNull();
  await act(async () => jest.advanceTimersByTime(1000));
  expect(view.getByText('Rp8.880.000')).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(INTRO_MS));
  expect(useIntro.getState().playing).toBe(false);
});

test('a tab holds its entrance until it is shown, plays it once per launch, and is plain without a launch', async () => {
  const body = () => (
    <TabEntrance id="budgets">
      <Rise order={0}>
        <Text>piece</Text>
      </Rise>
    </TabEntrance>
  );
  const plain = await render(body());
  expect(plain.getByText('piece')).toBeTruthy();
  expect(mockFocus).not.toHaveBeenCalled();
  await plain.unmount();

  armIntro();
  const first = await render(body());
  expect(first.getByText('piece')).toBeTruthy();
  expect(mockFocus).toHaveBeenCalled();
  expect(tabHasEntered('budgets')).toBe(true);
  await first.unmount();
  mockFocus.mockClear();
  await render(body());
  expect(mockFocus).not.toHaveBeenCalled(); // already made its entrance
});

