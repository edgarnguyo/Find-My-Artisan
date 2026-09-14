import { useState } from 'react';
import { AuthContext } from './authContext';
import { register, login } from '../api/auth';

// The signed-in user ({ id, name, email, role }) is kept in localStorage,
// so reloading the page keeps you signed in.
const STORAGE_KEY = 'fma_user';

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function storeUser(user) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage blocked: you stay signed in until the page is reloaded.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  async function signUp(details) {
    const newUser = await register(details);
    storeUser(newUser);
    setUser(newUser);
    return newUser;
  }

  async function signIn(email, password) {
    const signedIn = await login(email, password);
    storeUser(signedIn);
    setUser(signedIn);
    return signedIn;
  }

  function signOut() {
    storeUser(null);
    setUser(null);
  }

  const value = { user, signUp, signIn, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
