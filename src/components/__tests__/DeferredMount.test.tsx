// DeferredMount draws its children one render later, so the part of a screen above it can be shown first.
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DeferredMount } from '../DeferredMount';

describe('DeferredMount', () => {
  test('its children are there once the render has settled', async () => {
    const view = await render(
      <DeferredMount>
        <Text>below the fold</Text>
      </DeferredMount>,
    );
    expect(view.getByText('below the fold')).toBeTruthy();
  });

  test('the parent renders once: only the deferred part renders a second time', async () => {
    let parentRenders = 0;
    function Parent() {
      parentRenders += 1;
      return (
        <DeferredMount>
          <Text>below the fold</Text>
        </DeferredMount>
      );
    }
    await render(<Parent />);
    expect(parentRenders).toBe(1);
  });
});
