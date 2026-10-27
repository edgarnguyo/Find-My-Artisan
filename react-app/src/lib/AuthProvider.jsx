import { useEffect, useState } from 'react';
import { AuthContext } from './authContext';
import { register, login, logout, fetchSignedInUser } from '../api/auth';

// Who is signed in is decided by the server's sign-in cookie, which the page
// can't read. So on load the page asks the server (GET /login), and a reload
// keeps you signed in for as long as the cookie lasts (a week).
// Older versions kept the user in localStorage; that copy is removed.
const OLD_STORAGE_KEY = 'fma_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // True until the server has answered "who is signed in?". RequireAuth waits
  // for it, so a reload doesn't bounce a signed-in visitor to the sign-in page.
  const [checking, setChecking] = useState(true);
  // True after signing out (or deleting the account) until the next sign-in,
  // so RequireAuth sends the visitor home instead of to "please sign in".
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem(OLD_STORAGE_KEY);
    } catch {
      // Storage blocked: there's nothing to remove.
    }
    let current = true;
    fetchSignedInUser()
      // The server can't be reached: carry on signed out.
      .catch(() => null)
      .then(signedIn => {
        if (!current) return;
        // Only if nobody signed in while this was on its way.
        setUser(existing => existing ?? signedIn);
        setChecking(false);
      });
    return () => {
      current = false;
    };
  }, []);

  async function signUp(details) {
    const newUser = await register(details);
    setUser(newUser);
    setSignedOut(false);
    return newUser;
  }

  async function signIn(email, password) {
    const signedIn = await login(email, password);
    setUser(signedIn);
    setSignedOut(false);
    return signedIn;
  }

  async function signOut() {
    try {
      await logout();
    } catch {
      // The server can't be reached. The page still forgets the user; the
      // cookie runs out on its own.
    }
    setUser(null);
    setSignedOut(true);
  }

  // After the account page saves a change (a new name), so the rest of the
  // site shows it without signing in again.
  function updateUser(changes) {
    setUser(current => ({ ...current, ...changes }));
  }

  const value = { user, checking, signedOut, signUp, signIn, signOut, updateUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
