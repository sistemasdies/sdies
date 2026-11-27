import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const IDLE_MS = 10 * 60 * 1000; // 10 minutos
const CHANNEL_NAME = 'sdies_idle';
const STORAGE_KEY = 'sdies_idle_reset';

/**
 * Cierra la sesión automáticamente cuando NINGUNA pestaña del navegador
 * registra actividad durante el tiempo definido.
 *
 * Si el usuario está activo en al menos una pestaña, todas las pestañas
 * reciben una señal de reinicio y permanecen abiertas.
 */
export default function useIdleLogout() {
  const { user, logout } = useAuth();
  const timerRef = useRef(null);
  const channelRef = useRef(null);

  const doLogout = useCallback(() => {
    logout();
    window.location.href = '/login';
  }, [logout]);

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doLogout, IDLE_MS);
    };

    const notifyOthers = () => {
      // BroadcastChannel (navegadores modernos)
      if (channelRef.current) {
        try { channelRef.current.postMessage({ type: 'reset' }); } catch {}
      }
      // Fallback con localStorage para compatibilidad
      try {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      } catch {}
    };

    const onActivity = () => {
      resetTimer();
      notifyOthers();
    };

    // Escuchar resets desde otras pestañas
    const onBroadcastMessage = (event) => {
      if (event?.data?.type === 'reset') resetTimer();
    };

    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) resetTimer();
    };

    // Inicializar canal
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channelRef.current = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current.onmessage = onBroadcastMessage;
      } catch {}
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    resetTimer();
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    window.addEventListener('storage', onStorage);

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      window.removeEventListener('storage', onStorage);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (channelRef.current) {
        try { channelRef.current.close(); } catch {}
      }
    };
  }, [user, doLogout]);
}
