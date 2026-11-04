// Read-only traffic: never creates reviews, bookings or accounts.
// PowerShell: $env:API='http://localhost:5001'; $env:KEY='<your-api-key>'; node traffic.js
// Bash: API=http://localhost:5001 KEY='<your-api-key>' node traffic.js
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTraffic({
  API = process.env.API || 'http://localhost:5001',
  KEY = process.env.KEY,
  N = Number(process.env.N || 60),
  delayMs = Number(process.env.DELAY_MS ?? 50),
  timeoutMs = Number(process.env.TIMEOUT_MS || 90000),
} = {}) {
  if (!KEY) throw new Error('Set KEY to the API key issued to you before running traffic.');
  if (!Number.isSafeInteger(N) || N < 1) throw new Error('N must be a positive whole number.');
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('DELAY_MS must be nonnegative.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('TIMEOUT_MS must be positive.');
  const base = new URL(API);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('API must be an HTTP(S) URL.');
  const mix = [
    { path: '/artisans', key: true },
    { path: '/artisans', key: true },
    { path: '/artisans/1', key: true },
    { path: '/artisans/999999', key: true },
    { path: '/artisans', key: false },
    // A genuinely unmatched API path: /not-a-route would serve the React site.
    { path: '/artisans/1/not-a-route', key: true },
  ];
  const counts = {};
  for (let i = 0; i < N; i++) {
    const r = mix[Math.floor(Math.random() * mix.length)];
    try {
      const res = await fetch(new URL(r.path, base), {
        headers: r.key ? { 'X-API-Key': KEY } : {},
        signal: AbortSignal.timeout(timeoutMs),
      });
      await res.arrayBuffer();
      counts[res.status] = (counts[res.status] || 0) + 1;
    } catch {
      counts.failed = (counts.failed || 0) + 1;
    }
    await pause(delayMs);
  }
  return counts;
}

if (require.main === module) {
  runTraffic().then(counts => {
    console.log('Status codes received:', JSON.stringify(counts));
    if (counts.failed) process.exitCode = 1;
  }).catch(err => {
    // Our validation messages contain no key, URL or server response body.
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = { runTraffic };
