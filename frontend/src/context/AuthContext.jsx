import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setToken, clearToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [company,   setCompany]   = useState(null);
  const [companyId, setCompanyId] = useState(() => localStorage.getItem('namo_cid') || '');
  const [loading,   setLoading]   = useState(true);

  // Bootstrap: try to restore session via refresh cookie
  useEffect(() => {
    const stored = localStorage.getItem('namo_token');
    const cid    = localStorage.getItem('namo_cid');
    if (stored && cid) {
      setToken(stored);
      setCompanyId(cid);
      api.get('/auth/me')
        .then(data => { setUser(data.user); setCompany(data.company); })
        .catch(() => { clearToken(); localStorage.removeItem('namo_token'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for forced logout events (401 that couldn't refresh)
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('namo:logout', handler);
    return () => window.removeEventListener('namo:logout', handler);
  }, []);

  const login = useCallback(async (email, password, cid) => {
    const data = await api.post('/auth/login', { email, password, companyId: cid });
    setToken(data.accessToken);
    localStorage.setItem('namo_token', data.accessToken);
    localStorage.setItem('namo_cid',   cid);
    setUser(data.user);
    setCompanyId(cid);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    setToken(data.accessToken);
    localStorage.setItem('namo_token', data.accessToken);
    localStorage.setItem('namo_cid',   data.company.companyId);
    setUser(data.user);
    setCompany(data.company);
    setCompanyId(data.company.companyId);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    clearToken();
    localStorage.removeItem('namo_token');
    localStorage.removeItem('namo_cid');
    setUser(null);
    setCompany(null);
    setCompanyId('');
  }, []);

  const value = {
    user, company, companyId, loading,
    login, register, logout,
    isAdmin:   user?.role === 'admin',
    isManager: ['admin', 'manager'].includes(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
