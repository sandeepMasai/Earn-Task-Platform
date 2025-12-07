const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure TypeScript and path aliases work correctly
config.resolver.sourceExts.push('tsx', 'ts');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');

module.exports = config;
