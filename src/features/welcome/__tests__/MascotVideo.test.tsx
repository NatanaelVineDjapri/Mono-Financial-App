import { render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { MascotVideo } from '../MascotVideo';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: jest.fn(() => false),
}));
const mockReduced = useReducedMotion as jest.MockedFunction<typeof useReducedMotion>;

beforeEach(() => mockReduced.mockReturnValue(false));

test('the poster is always there, and the mascot is hidden from screen readers (decoration only)', async () => {
  await render(<MascotVideo />);
  expect(screen.getByTestId('welcome-poster', { includeHiddenElements: true })).toBeTruthy();
  const frame = screen.getByTestId('welcome-mascot', { includeHiddenElements: true });
  expect(frame.props.importantForAccessibility).toBe('no-hide-descendants');
});

test('with reduced motion only the poster is drawn: the video module is not even loaded', async () => {
  mockReduced.mockReturnValue(true);
  const spy = jest.fn();
  jest.doMock('expo-video', () => {
    spy();
    return {};
  });
  await render(<MascotVideo />);
  expect(screen.getByTestId('welcome-poster', { includeHiddenElements: true })).toBeTruthy();
  expect(spy).not.toHaveBeenCalled();
});

test('a build without the video module still shows the poster instead of crashing', async () => {
  jest.doMock('expo-video', () => {
    throw new Error("Cannot find native module 'ExpoVideo'");
  });
  await render(<MascotVideo />);
  expect(screen.getByTestId('welcome-poster', { includeHiddenElements: true })).toBeTruthy();
});
