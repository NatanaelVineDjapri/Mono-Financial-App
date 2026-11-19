// A build without the MapLibre native module (a dev build made before it was added, or a test) must not crash
// the screen that imports the map: it shows the offline look and says so.
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LocationMap, type MapState } from '../LocationMap';

jest.mock('@maplibre/maplibre-react-native', () => {
  throw new Error("Cannot find native module 'MLRNModule'");
});

describe('LocationMap without the map module', () => {
  test('it renders the offline look and reports offline, without throwing', async () => {
    const onStateChange = jest.fn();
    const view = await render(
      <LocationMap latE6={-6_208_800} lngE6={106_845_600} onStateChange={onStateChange}>
        <Text>offline look</Text>
      </LocationMap>,
    );
    expect(view.getByText('offline look')).toBeTruthy();
    const states = onStateChange.mock.calls.map(([s]) => s as MapState);
    expect(states[states.length - 1]).toBe('offline');
    expect(view.getByTestId('location-map')).toBeTruthy();
  });
});
