import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './authContext';
import { fetchMyProfile } from '../api/profiles';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // There may already be a session in localStorage from a previous visit,
    // so ask for it once on mount before trusting the "signed out" state.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Then keep in step with sign in, sign out, and token refresh.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // The profile carries the name, contact and role. It is a separate table, so
  // it has to be fetched whenever the account changes — and cleared on sign
  // out, or the next user would briefly see the previous one's details.
  const userId = session?.user?.id ?? null;

  const reloadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const next = await fetchMyProfile();
    setProfile(next);
    return next;
  }, [userId]);

  // Clearing during render rather than in an effect: the moment the account
  // changes, the previous user's profile must already be gone, and React
  // applies a render-phase update before anything paints.
  const [profileFor, setProfileFor] = useState(userId);
  if (profileFor !== userId) {
    setProfileFor(userId);
    setProfile(null);
  }

  useEffect(() => {
    let cancelled = false;
    if (!userId) return undefined;

    fetchMyProfile()
      .then(next => {
        if (!cancelled) setProfile(next);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    // Until the profile row has loaded, treat the account as a client — that
    // is the role the trigger defaults to, and it hides nothing sensitive.
    role: profile?.role ?? 'client',
    isArtisan: profile?.role === 'artisan',
    loading,
    reloadProfile,
    // The extra fields ride along as user metadata; a trigger on auth.users
    // copies them into the profiles row when the account is created.
    signUp: (email, password, meta = {}) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: meta.fullName ?? '',
            contact: meta.contact ?? '',
            role: meta.role === 'artisan' ? 'artisan' : 'client',
          },
        },
      }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
