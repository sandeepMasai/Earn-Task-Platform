const assert = require('node:assert/strict');
async function start(origin, base) {
  const url = new URL(origin);
  if (url.origin !== origin || origin === '*' || !['http:', 'https:'].includes(url.protocol)) throw new Error('Exact browser origin required');
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    // Supply only the empty test document. API and R2 requests go to real servers.
    await page.route(origin + '/__r2_validation', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>R2 validation</title>' }));
    await page.goto(origin + '/__r2_validation');
    const session = await page.context().newCDPSession(page);
    await session.send('Network.enable');
    const preflights = new Map();
    session.on('Network.requestWillBeSent', e => { if (e.request.method === 'OPTIONS' && new URL(e.request.url).hostname.endsWith('.r2.cloudflarestorage.com')) preflights.set(e.requestId, null); });
    session.on('Network.responseReceived', e => { if (preflights.has(e.requestId)) preflights.set(e.requestId, e.response.status); });
    return {
      close: () => browser.close(),
      async request(method, route, token, body) {
        return page.evaluate(async ({ base, method, route, token, body }) => {
          const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
          return { status: response.status, body: await response.json() };
        }, { base, method, route, token, body });
      },
      async put(signed, bytes) {
        preflights.clear();
        const status = await page.evaluate(async ({ signed, bytes }) => {
          const headers = { ...signed.headers }; delete headers['Content-Length']; // Browser sets the signed length from the byte body.
          const response = await fetch(signed.url, { method: 'PUT', headers, body: new Uint8Array(bytes) });
          await response.arrayBuffer(); return response.status;
        }, { signed, bytes: Array.from(bytes) });
        assert.ok([...preflights.values()].some(status => status >= 200 && status < 300), 'Successful real R2 preflight required');
        return status;
      }
    };
  } catch (e) { await browser.close(); throw e; }
}
module.exports = { start };
