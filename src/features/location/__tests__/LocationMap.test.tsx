// The map with the MapLibre module present (mocked): OpenFreeMap's style, a camera on the point, every gesture
// off, and the state following the map's own load events.
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LocationMap, MAP_STYLE_URL, MAP_ZOOM, type MapState } from '../LocationMap';

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return {
    Map: (props: Record<string, unknown>) => <MockView testID="maplibre-map" {...props} />,
    Camera: (props: Record<string, unknown>) => <MockView testID="maplibre-camera" {...props} />,
  };
});

const LAT = -6_208_800;
const LNG = 106_845_600;
const lastState = (fn: jest.Mock): MapState => fn.mock.calls[fn.mock.calls.length - 1][0];

describe('LocationMap with the map module', () => {
  test('draws OpenFreeMap\'s street style, with the camera on the saved point at street zoom', async () => {
    const view = await render(<LocationMap latE6={LAT} lngE6={LNG} />);
    const map = view.getByTestId('maplibre-map');
      expect(map.props.mapStyle).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(MAP_STYLE_URL).toBe(map.props.mapStyle);
    expect(view.getByTestId('maplibre-camera').props.initialViewState).toEqual({ center: [106.8456, -6.2088], zoom: MAP_ZOOM });
  });

  test('every gesture is off, so the map never takes the scroll from the screen', async () => {
    const view = await render(<LocationMap latE6={LAT} lngE6={LNG} />);
    const map = view.getByTestId('maplibre-map');
    for (const gesture of ['dragPan', 'touchZoom', 'doubleTapZoom', 'doubleTapHoldZoom', 'touchRotate', 'touchPitch']) {
      expect(map.props[gesture]).toBe(false);
    }
  });

  test('the state is loading, then ready when the map says it has loaded', async () => {
    const onStateChange = jest.fn();
    const view = await render(<LocationMap latE6={LAT} lngE6={LNG} onStateChange={onStateChange} />);
    expect(lastState(onStateChange)).toBe('loading');
    await fireEvent(view.getByTestId('maplibre-map'), 'didFinishLoadingMap');
    expect(lastState(onStateChange)).toBe('ready');
  });

  test('when the map fails to load the state is offline and the offline look is still under it', async () => {
    const onStateChange = jest.fn();
    const view = await render(
      <LocationMap latE6={LAT} lngE6={LNG} onStateChange={onStateChange}>
        <Text>offline look</Text>
      </LocationMap>,
    );
    await fireEvent(view.getByTestId('maplibre-map'), 'didFailLoadingMap');
    expect(lastState(onStateChange)).toBe('offline');
    expect(view.getByText('offline look')).toBeTruthy();
  });

  test('the pin is always drawn', async () => {
    const view = await render(<LocationMap latE6={LAT} lngE6={LNG} />);
    expect(view.getByTestId('location-map-pin')).toBeTruthy();
  });
});
