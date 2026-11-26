// A small, still map of a saved point, drawn by MapLibre Native from OpenFreeMap's free vector tiles (roads,
// blocks and place names; no API key, no account). The dark style keeps the map minimal and low-contrast,
// matching MONO's charcoal UI while preserving useful road, water and place hierarchy.
// Gestures are off so the map never fights the screen's own scrolling.
//
// This is one of the few things in the app that touch the network (CLAUDE.md rule 8), and only for a
// location the person already saved: the map asks tiles.openfreemap.org for the style and for the tiles
// around the point (an area about a kilometre across). The exact coordinates, the amount and the name of the
// place are never sent. When the map cannot load, or the build has no map module, the card keeps its offline
// look (`children`, drawn underneath) and says so.
//
// The map library is a native module, loaded here on purpose with a guarded require: a build made before it
// was added (or a test) must show the offline look, never crash the screen that imports this file.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MonoColors } from '@/theme/tokens';

export type MapState = 'loading' | 'ready' | 'offline';

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const MAP_ZOOM = 15; // street level

type MapLibre = typeof import('@maplibre/maplibre-react-native');

function loadMapLibre(): MapLibre | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy and guarded, see above
    return require('@maplibre/maplibre-react-native') as MapLibre;
  } catch {
    return null;
  }
}

export interface LocationMapProps {
  latE6: number;
  lngE6: number;
  onStateChange?: (state: MapState) => void;
  // The offline look: drawn under the map, so it is what shows when the map is missing or cannot load.
  children?: ReactNode;
}

export function LocationMap({ latE6, lngE6, onStateChange, children }: LocationMapProps) {
  const maplibre = useMemo(() => loadMapLibre(), []);
  const [state, setState] = useState<MapState>(maplibre ? 'loading' : 'offline');
  const center = useMemo<[number, number]>(() => [lngE6 / 1_000_000, latE6 / 1_000_000], [latE6, lngE6]);

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  return (
    <View style={StyleSheet.absoluteFill} testID="location-map">
      {children}
      {maplibre && (
        // pointerEvents none: the card scrolls with the screen, the map is only to look at
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <maplibre.Map
            style={StyleSheet.absoluteFill}
            mapStyle={MAP_STYLE_URL}
            dragPan={false}
            touchZoom={false}
            doubleTapZoom={false}
            doubleTapHoldZoom={false}
            touchRotate={false}
            touchPitch={false}
            compass={false}
            logo={false}
            onDidFinishLoadingMap={() => setState('ready')}
            onDidFailLoadingMap={() => setState('offline')}
          >
            <maplibre.Camera key={`${center[0]},${center[1]}`} initialViewState={{ center, zoom: MAP_ZOOM }} />
          </maplibre.Map>
        </View>
      )}
      <View style={styles.pinWrap} pointerEvents="none" testID="location-map-pin">
        <View style={styles.pinRing}>
          <View style={styles.pinDot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pinRing: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(199,205,214,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.78)', shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  pinDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: MonoColors.text, borderWidth: 4, borderColor: MonoColors.accent },
});
