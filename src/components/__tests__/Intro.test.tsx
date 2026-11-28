// The entrance: a figure starts low and ends on its exact value; outside the entrance it is simply there.
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CountUpAmount, Reveal } from '../Intro';
import { markAppReady, resetAppReady } from '@/core/appReady';
import { armIntro, INTRO_MS, resetIntro, useIntro } from '@/core/intro';

beforeEach(() => {
  jest.useFakeTimers();
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
  await act(async () => jest.advanceTimersByTime(450));
  expect(view.queryByText('Rp0')).toBeNull();
  expect(view.queryByText('Rp8.880.000')).toBeNull();
  await act(async () => jest.advanceTimersByTime(700));
  expect(view.getByText('Rp8.880.000')).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(INTRO_MS));
  expect(useIntro.getState().playing).toBe(false);
});
