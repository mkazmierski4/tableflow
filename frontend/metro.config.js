const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Metro's package-exports resolution picks tslib's ESM build, which has no default export,
// and the packages that use `import tslib from 'tslib'` (Moti's dependencies) then crash
// during web rendering. Pin tslib to its CommonJS build.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'node_modules/tslib/tslib.js') };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
