// react-native-nfc-manager reads the Android SDK it compiles against from `rootProject.ext.compileSdk`, but Expo's root
// project sets `compileSdkVersion`. Without this the library falls back to its own default (34), which a build machine
// that only has the newer platforms installed cannot find ("Failed to find Platform SDK android-34"). This copies the
// project's value across, once, in the generated root build.gradle (android/ is generated, so it is done by a plugin and
// survives every prebuild).
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// mono: nfc-manager compileSdk';

module.exports = function withNfcManagerCompileSdk(config) {
  return withProjectBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') return mod;
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += `
${MARKER}
ext.compileSdk = ext.has('compileSdkVersion') ? ext.get('compileSdkVersion') : 36
`;
    }
    return mod;
  });
};
