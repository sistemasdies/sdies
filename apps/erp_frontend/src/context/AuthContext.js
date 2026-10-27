import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  login as apiLogin, logout as apiLogout, getMe,
  asumirRol as apiAsumirRol, retomarRol as apiRetomarRol,
} from '../api/auth';
import { getDatosGenerales } from '../api/datosGenerales';

const AuthContext = createContext(null);
const CLAVE_ROL = 'rol_activo_id';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [marca, setMarca]     = useState(null);

  const refrescarMarca = async () => {
    try {
      const { data } = await getDatosGenerales();
      setMarca(data);
      return data;
    } catch {
      setMarca(null);
    }
  };

  // Guarda el usuario y limpia el rol asumido si el servidor ya no lo aplica
  // (por ejemplo, porque el rol fue eliminado).
  const aplicarMe = (data) => {
    if (!data.rol_activo) localStorage.removeItem(CLAVE_ROL);
    setUser(data);
    return data;
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      getMe()
        .then(({ data }) => { aplicarMe(data); refrescarMarca(); })
        .catch(() => localStorage.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    localStorage.removeItem(CLAVE_ROL);
    const { data } = await apiLogin(email, password);
    localStorage.setItem('access_token',  data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const me = await getMe();
    aplicarMe(me.data);
    refrescarMarca();
    return me.data;
  };

  const logout = async () => {
    try {
      await apiLogout(localStorage.getItem('refresh_token'));
    } catch {}
    localStorage.removeItem(CLAVE_ROL);
    localStorage.clear();
    setUser(null);
    setMarca(null);
  };

  const refrescar = async () => {
    const { data } = await getMe();
    return aplicarMe(data);
  };

  const asumirRol = async (roleId) => {
    const { data } = await apiAsumirRol(roleId);
    localStorage.setItem(CLAVE_ROL, String(roleId));
    return aplicarMe(data);
  };

  const retomarRol = async () => {
    try {
      const { data } = await apiRetomarRol();
      localStorage.removeItem(CLAVE_ROL);
      return aplicarMe(data);
    } catch (error) {
      // Aunque falle la confirmación, se deja de enviar el rol asumido.
      localStorage.removeItem(CLAVE_ROL);
      await refrescar().catch(() => {});
      throw error;
    }
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
    <AuthContext.Provider value={{ user, loading, login, logout, refrescar, marca, refrescarMarca,
                                   asumirRol, retomarRol,
                                   hasPermission, hasModulePermission, hasControl }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
