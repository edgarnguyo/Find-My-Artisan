import { useEffect, useState } from 'react';
import { AuthContext } from './authContext';
import { getToken, setToken, clearToken } from '../api/client';
import * as authApi from '../api/auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only wait when there is a saved token to check; with none, nobody is signed in.
  const [loading, setLoading] = useState(() => getToken() !== null);

  useEffect(() => {
    if (getToken() === null) return;

    // A token saved on a previous visit may have expired, so ask the server who
    // it belongs to before treating the user as signed in.
    let cancelled = false;
    authApi.fetchMe()
      .then(me => {
        if (!cancelled) setUser(me);
      })
      .catch(err => {
        // 401 means the token is no longer valid. Any other failure (for example
        // the API being off) keeps the token so a later reload can try again.
        if (err.status === 401) clearToken();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function signUp(details) {
    const { token, user: newUser } = await authApi.signUp(details);
    setToken(token);
    setUser(newUser);
    return newUser;
  }

  async function signIn(email, password) {
    const { token, user: signedIn } = await authApi.signIn(email, password);
    setToken(token);
    setUser(signedIn);
    return signedIn;
  }

  // The server keeps no session, so signing out is just forgetting the token.
  function signOut() {
    clearToken();
    setUser(null);
  }

  const value = { user, loading, signUp, signIn, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
