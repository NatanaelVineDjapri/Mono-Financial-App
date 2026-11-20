// The shared confirm sheet of a fixed expense: when the account cannot cover the amount, the sheet says by how
// much (Record stays off, never silent); when the database refuses at the moment of saving, the sheet stays open
// and says so in words.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { RecurringDueRow } from '@/data/repo/recurring';
import { DomainError } from '@/domain/errors';
import { confirmRecurring } from '@/domain/recurring';

import { RecurringConfirmHost } from '../RecurringConfirmHost';
import { closeConfirmSheet, openConfirmSheet } from '../recurringConfirmStore';

let mockBalance = 500_000;
jest.mock('@/data/db/DbProvider', () => ({
  useDb: () => ({ getFirstAsync: jest.fn(async () => ({ name: 'BCA Tabungan', balance: mockBalance })) }),
}));
jest.mock('@/domain/recurring', () => ({
  ...jest.requireActual('@/domain/recurring'),
  confirmRecurring: jest.fn(),
  skipRecurring: jest.fn(),
}));
jest.mock('@/components/toast-store', () => ({ showToast: jest.fn() }));

const mockConfirm = confirmRecurring as jest.MockedFunction<typeof confirmRecurring>;

const DUE = {
  recurring_id: 1,
  name: 'Gym',
  amount: 200_000,
  amount_varies: 0,
  account_id: 1,
  category_id: 2,
  category_name: 'Health',
  day_of_month: 28,
  due_on: '2026-10-28',
} as unknown as RecurringDueRow;

async function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <RecurringConfirmHost />
    </QueryClientProvider>,
  );
  await act(async () => openConfirmSheet(DUE));
  await waitFor(() => expect(screen.getAllByText('BCA Tabungan', { exact: false }).length).toBeGreaterThan(0));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBalance = 500_000;
});
afterEach(() => act(async () => closeConfirmSheet()));

test('enough balance: no warning, Record goes through the domain', async () => {
  mockConfirm.mockResolvedValue({ transactionId: 9, balanceAfter: 300_000 } as never);
  await open();
  expect(screen.queryByTestId('recurring-confirm-short')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Catat pengeluaran' }));
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
});

test('not enough balance: the sheet says by how much, and Record does nothing', async () => {
  mockBalance = 150_000;
  await open();
  await waitFor(() => expect(screen.getByTestId('recurring-confirm-short')).toBeTruthy());
  expect(screen.getByTestId('recurring-confirm-short').props.children).toContain('Rp50.000');
  await fireEvent.press(screen.getByRole('button', { name: 'Catat pengeluaran' }));
  expect(mockConfirm).not.toHaveBeenCalled();
});

test('the database refuses at save time: the sheet stays open with the guard message', async () => {
  mockConfirm.mockRejectedValue(new DomainError('before_opening_date'));
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Catat pengeluaran' }));
  await waitFor(() => expect(screen.getByTestId('recurring-confirm-error')).toBeTruthy());
  expect(screen.getByTestId('recurring-confirm-error').props.children).toBe('This date is before the account was opened.');
  expect(screen.getByText('Gym', { exact: false })).toBeTruthy(); // still open
});

test('anything else that fails says "Couldn\'t save" and nothing technical', async () => {
  mockConfirm.mockRejectedValue(new Error('SQLITE_BUSY'));
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Catat pengeluaran' }));
  await waitFor(() => expect(screen.getByTestId('recurring-confirm-error')).toBeTruthy());
  expect(screen.getByTestId('recurring-confirm-error').props.children).toBe("Couldn't save. Nothing was changed.");
});
