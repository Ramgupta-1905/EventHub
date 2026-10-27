import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const response = await apiFetch('/auth/me');
      setAccount(response.account);
      return response.account;
    } catch (error) {
      if (error.status === 401) {
        setAccount(null);
        return null;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/auth/me')
      .then((response) => {
        if (active) setAccount(response.account);
      })
      .catch((error) => {
        if (active && error.status === 401) setAccount(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const response = await apiFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccount(response.account);
    return response.account;
  }, []);

  const signUp = useCallback(async (details) => {
    const response = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(details),
    });
    setAccount(response.account);
    return response.account;
  }, []);

  const adminSignIn = useCallback(async (email, password) => {
    const response = await apiFetch('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccount(response.account);
    return response.account;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      setAccount(null);
    }
  }, []);

  const value = useMemo(() => ({
    account,
    loading,
    refreshAuth,
    signIn,
    signUp,
    adminSignIn,
    signOut,
  }), [account, loading, refreshAuth, signIn, signUp, adminSignIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
