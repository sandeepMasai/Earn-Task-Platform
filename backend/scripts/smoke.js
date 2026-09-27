// Read-only production probe. Mutating flows belong in disposable staging tests.
const url = process.env.SMOKE_BASE_URL;
if (!url || !/^https?:\/\//.test(url)) { console.error('Set SMOKE_BASE_URL'); process.exit(1); }
(async () => {
  let failed = false;
  for (const [route, expected] of [['/health', 200], ['/ready', 200], ['/api/tasks', 401], ['/not-a-route', 404]]) {
    try {
      const response = await fetch(url.replace(/\/$/, '') + route, { signal: AbortSignal.timeout(10000) });
      const ok = response.status === expected && response.headers.get('x-content-type-options') === 'nosniff';
      console.log(`${ok ? 'PASS' : 'FAIL'} ${route}: HTTP ${response.status}`);
      if (!ok) failed = true;
    } catch { console.log(`FAIL ${route}: connection failed`); failed = true; }
  }
  process.exitCode = failed ? 1 : 0;
})();
