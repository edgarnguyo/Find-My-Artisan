// Week 11: fetch with a timeout and a few careful retries, for calls to a partner.
//
// The rules:
//  - Every attempt gives up after timeoutMs (fetch then throws a TimeoutError).
//  - Retry only what a second try can fix: a timeout, a dropped connection, or
//    a 429/500/502/503/504 answer. A 400/401/403/404 comes straight back, since
//    asking again with the same request gets the same answer.
//  - Never retry a write (POST, PUT, PATCH, DELETE): it may happen twice.
//  - At most `retries` extra attempts, waiting delayMs, then twice that, between them.
//    A 429 waits for its Retry-After instead, up to 5 seconds.

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Why an attempt failed, for the log. Never includes headers, so never the token.
function failureReason(err) {
  return err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code || err.message);
}

/**
 * Like fetch, but with a timeout and retries. Returns the last Response (which
 * may still be a 5xx once the retries run out) or throws the last error.
 * `label` names the call in the "retrying" log lines.
 */
async function fetchWithRetry(url, options = {}, config = {}) {
  const { timeoutMs = 2000, retries = 2, delayMs = 200, label = 'partner call' } = config;
  const method = (options.method || 'GET').toUpperCase();
  const maxRetries = method === 'GET' ? retries : 0; // never retry writes

  for (let attempt = 0; ; attempt++) {
    let wait = delayMs * 2 ** attempt; // 200 ms, then 400 ms
    let why;
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if (!RETRY_STATUSES.has(res.status) || attempt >= maxRetries) return res;
      why = `status ${res.status}`;
      const retryAfter = Number(res.headers.get('Retry-After'));
      if (res.status === 429 && retryAfter > 0) {
        wait = Math.min(retryAfter * 1000, 5000); // wait as asked, up to 5 s
      }
    } catch (err) {
      if (attempt >= maxRetries) throw err; // out of retries
      why = failureReason(err);
    }
    console.warn(`${label}: attempt ${attempt + 1} failed (${why}), retrying in ${wait} ms`);
    await sleep(wait);
  }
}

module.exports = { fetchWithRetry, failureReason, RETRY_STATUSES };
