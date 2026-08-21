import { useState, useEffect } from 'react';

const INITIAL = { data: null, error: null, loading: true };

/**
 * Runs an async function once (or again whenever `deps` change) and tracks the
 * three states every database request has: loading, error, and data.
 */
export function useAsync(fn, deps = []) {
  const depsKey = JSON.stringify(deps);
  const [state, setState] = useState(INITIAL);
  const [lastKey, setLastKey] = useState(depsKey);

  // deps changed: drop the previous result and go back to loading before the
  // new request starts, so callers never render stale data for the new deps.
  if (lastKey !== depsKey) {
    setLastKey(depsKey);
    setState(INITIAL);
  }

  useEffect(() => {
    let cancelled = false;

    fn()
      .then(data => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch(error => {
        if (!cancelled) setState({ data: null, error, loading: false });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return state;
}
