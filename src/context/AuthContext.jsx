/**
 * Authentication state for the whole app.
 *
 * The user object always comes from GET /auth/me -- the role is never inferred
 * from the JWT on the client, so a tampered token cannot unlock UI. The backend
 * is the authority either way; this just keeps the two consistent.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authService, tokenStore } from '../services';
import { setAuthFailureHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const signOutLocally = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  // A failed token refresh anywhere in the app lands here.
  useEffect(() => {
    setAuthFailureHandler(signOutLocally);
  }, [signOutLocally]);

  // Restore the session on a page reload.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStore.access) {
        setStatus('anonymous');
        return;
      }
      try {
        const profile = await authService.me();
        if (!cancelled) {
          setUser(profile);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) signOutLocally();
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [signOutLocally]);

  const login = useCallback(async (username, password) => {
    const response = await authService.login(username, password);
    tokenStore.set(response);
    setUser(response.user);
    setStatus('authenticated');
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Signing out locally matters more than recording it server-side.
    }
    signOutLocally();
  }, [signOutLocally]);

  const value = useMemo(
    () => ({
      user,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      role: user?.role ?? null,
      clinics: user?.clinics ?? [],
      login,
      logout,
      refreshProfile: async () => {
        const profile = await authService.me();
        setUser(profile);
        return profile;
      },
    }),
    [user, status, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
