// The other tabs are mounted in the background one after the other, a while after the Overview has settled.
import { act, render } from '@testing-library/react-native';

import { FIRST_PRELOAD_DELAY_MS, NEXT_PRELOAD_DELAY_MS, PRELOAD_TABS, PreloadTabs } from '../PreloadTabs';

const mockPrefetch = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ prefetch: mockPrefetch }) }));

beforeEach(() => {
  jest.useFakeTimers();
  mockPrefetch.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('PreloadTabs', () => {
  test('nothing is prefetched while the Overview is still opening', async () => {
    await render(<PreloadTabs />);
    await act(async () => jest.advanceTimersByTime(FIRST_PRELOAD_DELAY_MS - 1));
    expect(mockPrefetch).not.toHaveBeenCalled();
  });

  test('then the tabs follow one at a time, never all at once', async () => {
    await render(<PreloadTabs />);
    await act(async () => jest.advanceTimersByTime(FIRST_PRELOAD_DELAY_MS));
    expect(mockPrefetch.mock.calls.map(call => call[0])).toEqual([PRELOAD_TABS[0]]);
    await act(async () => jest.advanceTimersByTime(NEXT_PRELOAD_DELAY_MS));
    expect(mockPrefetch.mock.calls.map(call => call[0])).toEqual([PRELOAD_TABS[0], PRELOAD_TABS[1]]);
    await act(async () => jest.advanceTimersByTime(NEXT_PRELOAD_DELAY_MS));
    expect(mockPrefetch.mock.calls.map(call => call[0])).toEqual([...PRELOAD_TABS]);
  });

  test('leaving the screen before the delay prefetches nothing', async () => {
    const view = await render(<PreloadTabs />);
    await view.unmount();
    await act(async () => jest.advanceTimersByTime(FIRST_PRELOAD_DELAY_MS * 5));
    expect(mockPrefetch).not.toHaveBeenCalled();
  });
});
