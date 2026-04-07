import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('beatx_token'));
  const [loading, setLoading] = useState(true);
  const logoutRef = useRef(null);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API });
    if (token) {
      instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    instance.interceptors.response.use(
      res => res,
      err => {
        const status = err.response?.status;
        const url = err.config?.url || '';
        const isBackgroundPoll = url.includes('unread') || url.includes('action-required') || url.includes('queue') || url.includes('count') || url.includes('pending');
        if (status === 401 && logoutRef.current) {
          logoutRef.current();
        } else if (status === 429) {
          const retryAfter = err.response?.headers?.['retry-after'] || '60';
          import('sonner').then(m => m.toast.error(`Rate limited. Try again in ${retryAfter}s`));
        } else if (status >= 500 && !isBackgroundPoll) {
          import('sonner').then(m => m.toast.error('Server error. Please try again later.'));
        }
        return Promise.reject(err);
      }
    );
    return instance;
  }, [token]);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('beatx_token');
  };

  logoutRef.current = logout;

  useEffect(() => {
    if (token) {
      api.get('/api/auth/me')
        .then(res => { setUser(res.data); setLoading(false); })
        .catch(() => { setToken(null); localStorage.removeItem('beatx_token'); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [token, api]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password });
    const { token: t, user: u } = res.data;
    setToken(t);
    setUser(u);
    localStorage.setItem('beatx_token', t);
    return u;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
