// The Overview's coverflow of account cards: tapping the focused card opens its account, tapping a neighbour only brings
// it to the centre, a drag settles on a card (a quick flick moves on by at least one), and only a handful of cards are
// ever drawn however many accounts there are.
import { fireEvent, render } from '@testing-library/react-native';

import type { AccountsOverviewAccount } from '@/domain/balances';

import { AccountsCarousel, settleTarget } from '../AccountsCarousel';

const accounts = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Account ${i + 1}`, type: 'bank', icon: null, balance: (i + 1) * 1000, pockets: null })) as unknown as AccountsOverviewAccount[];

async function renderCarousel(n = 3) {
  const onOpenAccount = jest.fn();
  const result = await render(<AccountsCarousel title="Your accounts" linkLabel="See all" accounts={accounts(n)} onOpenAll={() => {}} onOpenAccount={onOpenAccount} />);
  return { result, onOpenAccount };
}

test('the focused card opens; a neighbour comes to the centre first and opens on the next tap', async () => {
  const { result, onOpenAccount } = await renderCarousel();
  await fireEvent.press(result.getByTestId('overview-account-1'));
  expect(onOpenAccount).toHaveBeenLastCalledWith(1);
  await fireEvent.press(result.getByTestId('overview-account-2'));
  expect(onOpenAccount).toHaveBeenCalledTimes(1);
  await fireEvent.press(result.getByTestId('overview-account-2'));
  expect(onOpenAccount).toHaveBeenLastCalledWith(2);
});

test('only the cards around the middle are drawn, and one account does not repeat', async () => {
  const many = await renderCarousel(8);
  expect(many.result.getAllByTestId(/^overview-account-\d+(-copy--?\d+)?$/, { includeHiddenElements: true })).toHaveLength(5);
  await many.result.unmount();
  const one = await renderCarousel(1);
  expect(one.result.getAllByTestId(/^overview-account-\d+(-copy--?\d+)?$/, { includeHiddenElements: true })).toHaveLength(1);
  expect(one.result.queryByTestId('overview-account-dot-0')).toBeNull();
});

test('a released drag rests on a card: carried by the speed, at least one on a flick, never more than three', () => {
  expect(settleTarget(0.2, 0, 0)).toBe(0); // a short slow drag springs back
  expect(settleTarget(0.7, 0, 0)).toBe(1);
  expect(settleTarget(0.2, 0, -600)).toBe(1); // a flick to the left moves on
  expect(settleTarget(-0.2, 0, 600)).toBe(-1);
  expect(settleTarget(0.5, 0, -2600)).toBe(2); // carried past one
  expect(settleTarget(1, 0, -9000)).toBe(3);
});
