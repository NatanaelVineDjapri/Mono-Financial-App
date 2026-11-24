// The Overview is never an empty black screen while its figures are read: shapes in the places of the real cards.
import { render } from '@testing-library/react-native';

import { BelowHeroSkeleton, HeroSkeleton } from '../OverviewSkeleton';

describe('OverviewSkeleton', () => {
  test('draws a balance-card shape and the account and quick record shapes, with no text', async () => {
    const view = await render(
      <>
        <HeroSkeleton />
        <BelowHeroSkeleton />
      </>,
    );
    expect(view.getByTestId('overview-hero-skeleton', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByTestId('overview-below-skeleton', { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByText(/./)).toBeNull();
  });

  test('screen readers skip it: it says nothing', async () => {
    const view = await render(<HeroSkeleton />);
    const node = view.getByTestId('overview-hero-skeleton', { includeHiddenElements: true });
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
