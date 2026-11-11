import { renderHook, waitFor } from '@testing-library/react-native';

import { setClockOverride } from '@/core/clock';
import { getSetting, setSetting } from '@/data/repo/settings';

import { GREETING_DAY_SETTING, GREETING_OPENS_SETTING, resetLaunchCountForTests, useGreeting } from '../useGreeting';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/settings', () => ({ getSetting: jest.fn(async () => null), setSetting: jest.fn(async () => {}) }));

const mockGet = getSetting as jest.MockedFunction<typeof getSetting>;
const mockSet = setSetting as jest.MockedFunction<typeof setSetting>;

// 28 Oct 2026 at the given WIB hour
const at = (hour: number) => setClockOverride(`2026-10-28T${String(hour).padStart(2, '0')}:15:00+07:00`);

function saved(day: string | null, opens: number | null) {
  mockGet.mockImplementation(async (_db, key) => (key === GREETING_DAY_SETTING ? day : key === GREETING_OPENS_SETTING ? (opens == null ? null : String(opens)) : null));
}

beforeEach(() => {
  jest.clearAllMocks();
  resetLaunchCountForTests();
  saved(null, null);
});
afterAll(() => setClockOverride(null));

describe('useGreeting', () => {
  test('nothing is shown until the count is read (so the line is never drawn twice)', async () => {
    at(8);
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => (release = resolve));
    mockGet.mockImplementation(async () => {
      await gate; // the settings read is still running
      return null;
    });
    const { result } = await renderHook(() => useGreeting());
    expect(result.current).toBeNull();
    release();
    await waitFor(() => expect(result.current).toBe('morning'));
  });

  test('the first open of a day greets by the time of day, and the count is saved', async () => {
    at(8);
    const { result } = await renderHook(() => useGreeting());
    await waitFor(() => expect(result.current).toBe('morning'));
    expect(mockSet).toHaveBeenCalledWith({ fake: 'db' }, 'greeting_day', '2026-10-28');
    expect(mockSet).toHaveBeenCalledWith({ fake: 'db' }, 'greeting_opens', '1');
  });

  test.each([
    [8, 'morning'],
    [13, 'afternoon'],
    [16, 'late_afternoon'],
    [20, 'evening'],
  ])('at %i o\'clock the first open says %s', async (hour, kind) => {
    at(hour);
    const { result } = await renderHook(() => useGreeting());
    await waitFor(() => expect(result.current).toBe(kind));
  });

  test('the second open of the same day still greets by the time', async () => {
    at(8);
    saved('2026-10-28', 1);
    const { result } = await renderHook(() => useGreeting());
    await waitFor(() => expect(result.current).toBe('morning'));
    expect(mockSet).toHaveBeenCalledWith({ fake: 'db' }, 'greeting_opens', '2');
  });

  test('the third open of the same day asks "how are you", at any hour', async () => {
    at(20);
    saved('2026-10-28', 2);
    const { result } = await renderHook(() => useGreeting());
    await waitFor(() => expect(result.current).toBe('checkin'));
    expect(mockSet).toHaveBeenCalledWith({ fake: 'db' }, 'greeting_opens', '3');
  });

  test('the next day starts again with a greeting by the time', async () => {
    at(8);
    saved('2026-10-27', 9);
    const { result } = await renderHook(() => useGreeting());
    await waitFor(() => expect(result.current).toBe('morning'));
    expect(mockSet).toHaveBeenCalledWith({ fake: 'db' }, 'greeting_opens', '1');
  });

  test('it counts once per launch: the screen drawn again does not count again', async () => {
    at(8);
    saved('2026-10-28', 1);
    const first = await renderHook(() => useGreeting());
    await waitFor(() => expect(first.result.current).toBe('morning'));
    const writes = mockSet.mock.calls.length;
    const again = await renderHook(() => useGreeting());
    await waitFor(() => expect(again.result.current).toBe('morning'));
    expect(mockSet.mock.calls.length).toBe(writes);
  });

  test('if the count cannot be read, it greets by the time of day', async () => {
    at(20);
    mockGet.mockRejectedValueOnce(new Error('disk'));
    const { result } = await renderHook(() => useGreeting());
    await waitFor(() => expect(result.current).toBe('evening'));
  });
});
