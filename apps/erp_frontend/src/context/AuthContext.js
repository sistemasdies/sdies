import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { login as apiLogin, logout as apiLogout, getMe } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      getMe()
        .then(({ data }) => setUser(data))
        .catch(() => localStorage.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await apiLogin(email, password);
    localStorage.setItem('access_token',  data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const me = await getMe();
    setUser(me.data);
    return me.data;
  };

  const logout = async () => {
    try {
      await apiLogout(localStorage.getItem('refresh_token'));
    } catch {}
    localStorage.clear();
    setUser(null);
  };

  const refrescar = async () => {
    const { data } = await getMe();
    setUser(data);
    return data;
  };

  const permSet = useMemo(() => {
    return new Set(user?.permission_codes || []);
  }, [user]);

  const hasPermission = useMemo(() => {
    return (code) => {
      if (user?.is_superuser) return true;
      return permSet.has(code);
    };
  }, [user, permSet]);

  const hasModulePermission = useMemo(() => {
    return (module, action) => {
      if (user?.is_superuser) return true;
      return permSet.has(`${module}.${action}`);
    };
  }, [user, permSet]);

  const hasControl = useMemo(() => {
    return (code) => {
      if (user?.is_superuser) return true;
      return (user?.controles || {})[code] !== 'D';
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refrescar, hasPermission, hasModulePermission, hasControl }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
