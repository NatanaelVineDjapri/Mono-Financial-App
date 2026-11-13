const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The schema is bundled as a static asset and read at runtime (src/data/db/open.ts),
// not parsed as JS source.
config.resolver.assetExts.push('sql');
// expo-sqlite's web implementation (wa-sqlite) ships its engine as a .wasm asset; without
// this, bundling any route that imports expo-sqlite for web fails to resolve it.
config.resolver.assetExts.push('wasm');

// Dev only: serve the bundle as one plain response. The dev client asks for "multipart/mixed" (so it can
// show download progress) and its chunked reader fails on this project's bundle ("Expected leading
// [0-9a-fA-F] character", black screen). Without the header Metro answers with a normal body.
const previousEnhance = config.server && config.server.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previousEnhance ? previousEnhance(middleware, server) : middleware;
    return (req, res, next) => {
      if (req.headers.accept && req.headers.accept.includes('multipart/mixed')) delete req.headers.accept;
      return base(req, res, next);
    };
  },
};

module.exports = config;
