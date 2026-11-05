import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DbProvider, useDb } from '../DbProvider';
import type { Db } from '../types';

// Never used by DbProvider itself — it only needs to exist long enough to reach context.
const FAKE_DB = {} as Db;

function ReadyChild() {
  useDb();
  return <Text testID="ready">ready</Text>;
}

function pending(): Promise<Db> {
  return new Promise(() => {});
}

describe('DbProvider', () => {
  test('shows the wait screen while openDb is pending', async () => {
    const result = await render(
      <DbProvider openDb={pending}>
        <ReadyChild />
      </DbProvider>,
    );
    expect(result.getByTestId('db-wait-screen')).toBeTruthy();
    expect(result.queryByTestId('ready')).toBeNull();
  });

  test('shows the error screen on failure, and "Coba lagi" retries', async () => {
    let calls = 0;
    const openDb = jest.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return FAKE_DB;
    });

    const result = await render(
      <DbProvider openDb={openDb}>
        <ReadyChild />
      </DbProvider>,
    );

    const errorScreen = await result.findByTestId('db-error-screen');
    expect(errorScreen).toBeTruthy();

    await fireEvent.press(result.getByRole('button', { name: 'Coba lagi' }));

    expect(await result.findByTestId('ready')).toBeTruthy();
    expect(openDb).toHaveBeenCalledTimes(2);
  });
});

describe('useDb', () => {
  test('throws a clear error outside a DbProvider', async () => {
    function NoProvider() {
      useDb();
      return null;
    }
    await expect(render(<NoProvider />)).rejects.toThrow('useDb() was called outside a <DbProvider>.');
  });
});
