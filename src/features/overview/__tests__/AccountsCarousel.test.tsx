// The Overview's coverflow of account cards: one card per swipe, and the loop's invisible jump to the middle copy happens
// only once a swipe has come to rest (a jump at the moment the finger lifts would cut the glide short and make it stutter).
//
// What the tests can see is which card counts as focused: tapping the focused card opens its account, tapping any other one
// only brings it to the centre. A swipe that has settled moves the focus; one still gliding does not.
import { fireEvent, render } from '@testing-library/react-native';

import type { AccountsOverviewAccount } from '@/domain/balances';

import { AccountsCarousel, CARD_INTERVAL } from '../AccountsCarousel';

const ACCOUNTS = [1, 2, 3].map(id => ({ id, name: `Account ${id}`, type: 'bank', icon: null, balance: id * 1000, pockets: null })) as unknown as AccountsOverviewAccount[];

// 3 accounts loop as 5 copies of the list; the middle copy starts at card 6, which is "Account 1". The card at index 10 is
// "Account 2" of the copy to the right of the middle one.
const COPY_TO_THE_RIGHT_ACCOUNT_2 = 10;

async function renderCarousel() {
  const onOpenAccount = jest.fn();
  const result = await render(<AccountsCarousel title="Your accounts" linkLabel="See all" accounts={ACCOUNTS} onOpenAll={() => {}} onOpenAccount={onOpenAccount} />);
  return { result, onOpenAccount, carousel: result.getByTestId('overview-account-carousel') };
}

function scrollEvent(x: number, velocity?: number) {
  return { nativeEvent: { contentOffset: { x, y: 0 }, ...(velocity !== undefined ? { velocity: { x: velocity, y: 0 } } : {}) } };
}

describe('AccountsCarousel', () => {
  test('one card per swipe: the row snaps card by card and does not coast over several', async () => {
    const { carousel } = await renderCarousel();
    expect(carousel.props.snapToInterval).toBe(CARD_INTERVAL);
    expect(carousel.props.disableIntervalMomentum).toBe(true);
  });

  test('when the glide ends on a card of another copy, that account is the focused one in the middle copy', async () => {
    const { result, onOpenAccount, carousel } = await renderCarousel();
    await fireEvent(carousel, 'momentumScrollEnd', scrollEvent(COPY_TO_THE_RIGHT_ACCOUNT_2 * CARD_INTERVAL));
    await fireEvent.press(result.getByTestId('overview-account-2'));
    expect(onOpenAccount).toHaveBeenCalledWith(2);
  });

  test('lifting the finger while the row is still gliding settles nothing: the glide is not cut short', async () => {
    const { result, onOpenAccount, carousel } = await renderCarousel();
    await fireEvent(carousel, 'scrollEndDrag', scrollEvent(COPY_TO_THE_RIGHT_ACCOUNT_2 * CARD_INTERVAL + 40, 1.4));
    await fireEvent.press(result.getByTestId('overview-account-2'));
    expect(onOpenAccount).not.toHaveBeenCalled(); // still "Account 1" that is focused: this tap only recentres
  });

  test('released at rest exactly on a card there is no glide to wait for, so it settles at once', async () => {
    const { result, onOpenAccount, carousel } = await renderCarousel();
    await fireEvent(carousel, 'scrollEndDrag', scrollEvent(COPY_TO_THE_RIGHT_ACCOUNT_2 * CARD_INTERVAL, 0));
    await fireEvent.press(result.getByTestId('overview-account-2'));
    expect(onOpenAccount).toHaveBeenCalledWith(2);
  });
});
