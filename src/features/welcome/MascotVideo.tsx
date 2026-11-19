// The mascot of the Welcome screen: a 7 second, silent, looping video (decoration only, it carries no
// information), faded into the screen colour at its edges. Until the video is ready, and always when the system
// asks for reduced motion or the build has no video module, the still poster is shown instead.
// expo-video is a native module, loaded here on purpose with a guarded require: a development build made before
// it was added (or a test) must show the poster, never crash the screen.
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, Rect, RadialGradient, Stop } from 'react-native-svg';

import { MonoColors } from '@/theme/tokens';

export const MASCOT_SIZE = 300;

type ExpoVideo = typeof import('expo-video');

function loadVideoModule(): ExpoVideo | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy and guarded, see above
    return require('expo-video') as ExpoVideo;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- bundled assets
const POSTER = require('@/assets/mascot/welcome-poster.jpg');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- bundled assets
const VIDEO = require('@/assets/mascot/welcome.mp4');

function LiveVideo({ video }: { video: ExpoVideo }) {
  const player = video.useVideoPlayer(VIDEO, instance => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return <video.VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />;
}

export function MascotVideo({ accessibilityLabel }: { accessibilityLabel?: string }) {
  const reducedMotion = useReducedMotion();
  const video = reducedMotion ? null : loadVideoModule();

  return (
    <View
      style={styles.frame}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      accessibilityLabel={accessibilityLabel}
      testID="welcome-mascot"
    >
      <View style={StyleSheet.absoluteFill} testID="welcome-poster">
        <Image source={POSTER} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
      {video && <LiveVideo video={video} />}
      {/* the edges fade into the screen colour */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <RadialGradient id="fade" cx="0.52" cy="0.5" rx="0.58" ry="0.56">
            <Stop offset="0.58" stopColor={MonoColors.bg} stopOpacity="0" />
            <Stop offset="1" stopColor={MonoColors.bg} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#fade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: MASCOT_SIZE, height: MASCOT_SIZE, alignSelf: 'center', backgroundColor: MonoColors.bg, overflow: 'hidden' },
});
