// The built site is served by the same Express server as the API, so paths like
// '/profiles' need no address in front: the browser uses the one the page came
// from, whether that is localhost or the hosted site. Only Vite's own dev server
// (npm run dev in react-app/) is on a different port and has to name the API.
export const API_URL = import.meta.env.DEV ? 'http://localhost:5001' : '';

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
      // Sends the sign-in cookie (set by /login) with every request. The built
      // site is on the same address as the API, where browsers send it anyway;
      // Vite's dev server is on another port, where they only do when asked.
      credentials: 'include',
    });
  } catch {
    // fetch only throws when no response came back at all, e.g. the server is off.
    // Browsers word that differently (Safari "Load failed", Chrome "Failed to fetch").
    throw new Error(`could not reach the API at ${API_URL || window.location.origin}. Is the server running?`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Website routes send { error }; the contract's routes (/artisans) send { code, message }.
    const error = new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}
