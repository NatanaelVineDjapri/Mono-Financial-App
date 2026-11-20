// The fixed-expense form: a save the database refuses is said in words and the form stays open (never silent);
// a good save closes the form.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DomainError } from '@/domain/errors';
import { createRecurring } from '@/domain/recurring';

import RecurringEditScreen from '../recurring/edit';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({}) }));
jest.mock('@/data/repo/accounts', () => ({
  listAccountsForForm: jest.fn(async () => [
    { id: 1, name: 'BCA Tabungan', type: 'bank', icon: null, balance: 1_000_000, openingDate: '2026-01-01' },
  ]),
}));
jest.mock('@/data/repo/categories', () => ({
  listCategories: jest.fn(async () => [{ id: 10, name: 'Health', kind: 'expense' }]),
}));
jest.mock('@/data/repo/recurring', () => ({ getRecurring: jest.fn(async () => null) }));
jest.mock('@/domain/recurring', () => ({
  ...jest.requireActual('@/domain/recurring'),
  createRecurring: jest.fn(),
  updateRecurring: jest.fn(),
  archiveRecurring: jest.fn(),
}));

const mockCreate = createRecurring as jest.MockedFunction<typeof createRecurring>;
const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

async function openFilled() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>
        <RecurringEditScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByText('Health')).toBeTruthy());
  await waitFor(() => expect(screen.getByText('BCA Tabungan')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Gym');
}

beforeEach(() => jest.clearAllMocks());

test('a guard of the database is shown above Simpan and the form stays open', async () => {
  mockCreate.mockRejectedValue(new DomainError('recurring_needs_idr_account'));
  await openFilled();
  // The amount, category and account are chosen through the same controls a person uses.
  await fireEvent.changeText(screen.getByTestId('recurring-amount-input'), '200000');
  await fireEvent.press(screen.getByText('Health'));
  await fireEvent.press(screen.getByText('BCA Tabungan'));
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await waitFor(() => expect(screen.getByTestId('recurring-save-error')).toBeTruthy());
  expect(mockBack).not.toHaveBeenCalled();
});

test('anything else that fails says "Couldn\'t save" and nothing technical', async () => {
  mockCreate.mockRejectedValue(new Error('SQLITE_BUSY'));
  await openFilled();
  await fireEvent.changeText(screen.getByTestId('recurring-amount-input'), '200000');
  await fireEvent.press(screen.getByText('Health'));
  await fireEvent.press(screen.getByText('BCA Tabungan'));
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await waitFor(() => expect(screen.getByTestId('recurring-save-error')).toBeTruthy());
  expect(screen.getByTestId('recurring-save-error').props.children).toBe("Couldn't save. Nothing was changed.");
  expect(mockBack).not.toHaveBeenCalled();
});

test('a good save closes the form', async () => {
  mockCreate.mockResolvedValue(1 as never);
  await openFilled();
  await fireEvent.changeText(screen.getByTestId('recurring-amount-input'), '200000');
  await fireEvent.press(screen.getByText('Health'));
  await fireEvent.press(screen.getByText('BCA Tabungan'));
  await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  expect(screen.queryByTestId('recurring-save-error')).toBeNull();
});
