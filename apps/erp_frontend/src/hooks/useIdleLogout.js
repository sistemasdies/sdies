import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const IDLE_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Cierra la sesión automáticamente después de un tiempo de inactividad.
 * Solo afecta al usuario actual (pestaña/sesión del navegador).
 */
export default function useIdleLogout() {
  const { user, logout } = useAuth();
  const timerRef = useRef(null);

  const doLogout = useCallback(async () => {
    await logout();
    window.location.href = '/login';
  }, [logout]);

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doLogout, IDLE_MS);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    resetTimer();
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, doLogout]);
}
