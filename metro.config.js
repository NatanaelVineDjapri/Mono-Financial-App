const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The schema is bundled as a static asset and read at runtime (src/data/db/open.ts),
// not parsed as JS source.
config.resolver.assetExts.push('sql');
// expo-sqlite's web implementation (wa-sqlite) ships its engine as a .wasm asset; without
// this, bundling any route that imports expo-sqlite for web fails to resolve it.
config.resolver.assetExts.push('wasm');

module.exports = config;
