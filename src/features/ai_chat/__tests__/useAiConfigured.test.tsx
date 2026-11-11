import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getSetting } from '@/data/repo/settings';

import { aiEntryRoute, useAiConfigured } from '../aiEntry';
import { hasKey } from '../keystore';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/settings', () => ({ getSetting: jest.fn(async () => null), setSetting: jest.fn(async () => {}) }));
jest.mock('../keystore', () => ({ hasKey: jest.fn(async () => false), getKey: jest.fn(async () => null), saveKey: jest.fn(), clearKey: jest.fn() }));

const mockHasKey = hasKey as jest.MockedFunction<typeof hasKey>;
const mockGetSetting = getSetting as jest.MockedFunction<typeof getSetting>;

const clients: QueryClient[] = [];
// One client per test, kept for the test's whole life (a client made inside the wrapper would be
// replaced on every render and the read would start over).
function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } });
  clients.push(client);
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => clients.splice(0).forEach(c => c.clear()));
beforeEach(() => jest.clearAllMocks());

describe('useAiConfigured: true only when a key is saved AND the switch is on', () => {
  test.each([
    ['0', false, false],
    ['1', false, false],
    ['0', true, false],
    ['1', true, true],
  ])('switch %s, key saved %s -> %s', async (switchValue, keySaved, expected) => {
    mockGetSetting.mockResolvedValue(switchValue);
    mockHasKey.mockResolvedValue(keySaved);
    const { result } = await renderHook(() => useAiConfigured(), { wrapper: makeWrapper() });
    if (expected) await waitFor(() => expect(result.current).toBe(true));
    else {
      await waitFor(() => expect(mockGetSetting).toHaveBeenCalled());
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20)); // let the query settle
      });
      expect(result.current).toBe(false);
    }
  });

  test('before the first read it is false, so an early tap on + opens the setup screen', async () => {
    mockGetSetting.mockResolvedValue('1');
    mockHasKey.mockResolvedValue(true);
    const { result } = await renderHook(() => useAiConfigured(), { wrapper: makeWrapper() });
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  test('the + goes to the chat when configured, to the setup otherwise', () => {
    expect(aiEntryRoute(true)).toBe('/ai-chat');
    expect(aiEntryRoute(false)).toBe('/ai-setup');
  });
});
