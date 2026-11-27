// The waiting transactions on the notification page: each opens its check screen; nothing when there are none.
import { fireEvent, render } from '@testing-library/react-native';

import type { QueueRowWithNames } from '@/data/repo/importQueue';

import { PendingReview } from '../PendingReview';

const item = { id: 7, kind: 'income', amount_idr: 1000, merchant: '***DI SANT**O', occurred_at: '2026-11-27T22:46:00+07:00', account_name: 'BCA', app_name: 'myBCA' } as QueueRowWithNames;

test('a waiting transaction shows its amount and account and opens on a press', async () => {
  const onOpen = jest.fn();
  const onOpenAll = jest.fn();
  const view = await render(<PendingReview items={[item]} onOpen={onOpen} onOpenAll={onOpenAll} />);
  expect(view.getByText('Menunggu ditinjau')).toBeTruthy();
  expect(view.getByText('+Rp1.000')).toBeTruthy();
  await fireEvent.press(view.getByTestId('notif-review-7'));
  expect(onOpen).toHaveBeenCalledWith(7);
  await fireEvent.press(view.getByText('Tinjau semua (1)'));
  expect(onOpenAll).toHaveBeenCalled();
});

test('nothing waiting draws nothing', async () => {
  const view = await render(<PendingReview items={[]} onOpen={jest.fn()} onOpenAll={jest.fn()} />);
  expect(view.queryByTestId('notif-review')).toBeNull();
});
