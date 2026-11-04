const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The schema is bundled as a static asset and read at runtime (src/data/db/open.ts),
// not parsed as JS source.
config.resolver.assetExts.push('sql');

module.exports = config;
