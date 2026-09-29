// Separate backend process: file transfer runs in the parent, never in this process.
process.env.NODE_ENV = 'test';
const { PerformanceObserver } = require('node:perf_hooks');
const storage = require('../../src/services/storage/storage.service');
let before, peak, cpu, gc;
const sample = () => { if (peak) { const m = process.memoryUsage(); for (const k in m) peak[k] = Math.max(peak[k], m[k]); } };
const timer = setInterval(sample, 5);
const observer = new PerformanceObserver(list => { if (gc) for (const e of list.getEntries()) { gc.count++; gc.durationMs += e.duration; } });
observer.observe({ entryTypes: ['gc'] });
process.on('message', async ({ id, action, input }) => {
  try {
    let result;
    if (action === 'begin') { global.gc?.(); before = process.memoryUsage(); peak = { ...before }; cpu = process.cpuUsage(); gc = { count: 0, durationMs: 0 }; result = await storage.presignUpload(input); }
    else if (action === 'inspect') { const asset = { provider: 'r2', storageKey: input.storageKey }; const metadata = await storage.getMetadata(asset); const prefix = await storage.readPrefix(asset); result = { metadata, inspectedBytes: prefix.length, url: await storage.getUrl(asset) }; }
    else if (action === 'finish') { sample(); const used = process.cpuUsage(cpu); result = { before, after: process.memoryUsage(), peak, cpuUserMs: used.user / 1000, cpuSystemMs: used.system / 1000, gc }; peak = undefined; }
    else if (action === 'stop') { clearInterval(timer); observer.disconnect(); process.exit(0); }
    process.send({ id, result });
  } catch { process.send({ id, error: 'Backend operation failed; sensitive details suppressed' }); }
});
