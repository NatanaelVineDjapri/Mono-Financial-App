// A card held to the phone opens the Scan kartu screen: on a cold start (the app was opened by the card) and while the app runs.
// The host only navigates; it waits for the first-launch Welcome and does nothing while a card screen is already open.
import { act, render } from '@testing-library/react-native';

import { NfcTapHost } from '../NfcTapHost';

const mockPush = jest.fn();
let mockPathname = '/';
let mockNeedsWelcome: boolean | undefined = false;
let mockOnTap: (() => void) | null = null;
const mockStop = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));
jest.mock('@/features/welcome/useNeedsWelcome', () => ({ useNeedsWelcome: () => mockNeedsWelcome }));
jest.mock('../cardReaderProvider', () => ({
  watchCardTaps: (onTap: () => void) => {
    mockOnTap = onTap;
    return mockStop;
  },
}));

beforeEach(() => {
  mockPush.mockClear();
  mockStop.mockClear();
  mockPathname = '/';
  mockNeedsWelcome = false;
  mockOnTap = null;
});

const tap = () => act(async () => mockOnTap?.());

describe('NfcTapHost', () => {
  test('a card held to the phone opens the Scan kartu screen', async () => {
    await render(<NfcTapHost />);
    await tap();
    expect(mockPush).toHaveBeenCalledWith('/nfc/scan');
  });

  test('while a card screen is open nothing happens: it is already waiting for the card', async () => {
    mockPathname = '/nfc/scan';
    await render(<NfcTapHost />);
    await tap();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('a card held before the app knows whether to show Welcome waits for the answer, and is not lost', async () => {
    mockNeedsWelcome = undefined;
    const view = await render(<NfcTapHost />);
    await tap();
    expect(mockPush).not.toHaveBeenCalled();
    mockNeedsWelcome = false;
    await view.rerender(<NfcTapHost />);
    expect(mockPush).toHaveBeenCalledWith('/nfc/scan');
  });

  test('on the first launch (Welcome) it does not open the scan over it', async () => {
    mockNeedsWelcome = true;
    const view = await render(<NfcTapHost />);
    await tap();
    await view.rerender(<NfcTapHost />);
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('it stops listening when it goes away', async () => {
    const view = await render(<NfcTapHost />);
    await view.unmount();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
