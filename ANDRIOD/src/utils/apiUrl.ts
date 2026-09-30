// Use the installed React Native implementation without importing its Node-global types.
const { URL: ApiURL } = require('react-native-url-polyfill') as { URL: typeof URL };

export function normalizeBaseURL(host: string): string {
  const input = host.trim().replace(/\/+$/, '');
  const explicitScheme = input.includes('://');
  const url = new ApiURL(explicitScheme ? input : `http://${input}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid API base URL');
  }
  if (!explicitScheme && !url.port) url.port = '3000';
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname.endsWith('/api') ? pathname : `${pathname}/api`;
  return url.toString().replace(/\/+$/, '');
}
