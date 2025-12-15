const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure TypeScript extensions are included (they should be by default, but ensure they're there)
if (!config.resolver.sourceExts.includes('tsx')) {
  config.resolver.sourceExts.push('tsx');
}
if (!config.resolver.sourceExts.includes('ts')) {
  config.resolver.sourceExts.push('ts');
}

// Remove svg from assetExts if you want to handle SVG as source files
// Otherwise, keep it commented out to keep default behavior
// config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');

module.exports = config;
