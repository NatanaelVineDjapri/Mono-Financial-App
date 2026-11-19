import { act, render, renderHook, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FILL_MS, ScoreRing, useRingFill } from '../ScoreRing';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: jest.fn(() => false),
}));
const mockReduced = useReducedMotion as jest.MockedFunction<typeof useReducedMotion>;

// requestAnimationFrame driven by the fake clock, 16 ms a frame
let frame = 0;
beforeEach(() => {
  jest.useFakeTimers();
  frame = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(cb => setTimeout(() => cb(Date.now()), 16) as unknown as number);
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => clearTimeout(id as unknown as NodeJS.Timeout));
  mockReduced.mockReturnValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  void frame;
});

const ring = (score: number | null) => <ScoreRing score={score} outOfLabel="dari 100" accessibilityLabel={score === null ? 'belum ada' : `Skor ${score}`} testID="ring" />;

test('the figure is the real score from the first frame, whatever the ring is doing', async () => {
  await render(ring(83));
  expect(screen.getByTestId('ring-value').props.children).toBe(83);
  expect(screen.getByLabelText('Skor 83')).toBeTruthy();
});

test('the ring fills over 600 ms', async () => {
  await render(ring(83));
  expect(FILL_MS).toBe(600);
  await act(async () => {
    jest.advanceTimersByTime(FILL_MS + 50);
  });
  expect(screen.getByTestId('ring-value').props.children).toBe(83);
});

test('with reduce motion on nothing animates: the ring is at its full length from the very first render', async () => {
  const reduced = await renderHook(() => useRingFill(83, true));
  expect(reduced.result.current).toBe(83);
  const animated = await renderHook(() => useRingFill(83, false));
  expect(animated.result.current).toBe(0); // starts empty and fills over 600 ms
});

test('without a score there is a dash and the label, never a number', async () => {
  await render(<ScoreRing score={null} outOfLabel="" centerLabel="belum ada" accessibilityLabel="belum ada" testID="ring" />);
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByText('belum ada')).toBeTruthy();
  expect(screen.queryByTestId('ring-value')).toBeNull();
});
