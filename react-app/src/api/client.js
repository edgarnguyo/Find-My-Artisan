export const API_URL = 'http://localhost:5001';

/**
 * Send a request to the Express API and return the JSON it sends back.
 * If the server answers with an error, throw it with the server's message.
 */
export async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // fetch only throws when no response came back at all, e.g. the server is off.
    // Browsers word that differently (Safari "Load failed", Chrome "Failed to fetch").
    throw new Error(`could not reach the API at ${API_URL}. Is the server running?`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}
