import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const IDLE_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Cierra la sesión automáticamente en la pestaña actual después de inactividad.
 * No afecta otras pestañas del mismo navegador.
 */
export default function useIdleLogout() {
  const { user, logoutTab } = useAuth();
  const timerRef = useRef(null);

  const doLogout = useCallback(() => {
    sessionStorage.setItem('idle_logout', '1');
    logoutTab();
    window.location.href = '/login';
  }, [logoutTab]);

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
