import { createContext, useContext } from 'react';

// Kept separate from AuthProvider.jsx so that file exports only a component,
// which is what Vite's fast refresh needs to hot-reload it reliably.
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
