import { useEffect, useRef, useState, useCallback } from 'react';
import { getPreferencias, savePreferencias } from '../api/preferencias';

/**
 * Carga/guarda las preferencias del usuario actual.
 * Las preferencias se guardan por pantalla (clave) como objeto completo:
 *   const { data, cargar, guardar, estaListo } = usePreferencias();
 */
export function usePreferencias() {
  const [data, setData] = useState(null);       // { pantalla: {...} }
  const [estaListo, setEstaListo] = useState(false);
  const cargadoNombre = useRef(null);           // evita doble carga en StrictMode
  const uid = useRef(
    typeof window !== 'undefined'
      ? `${location?.pathname || ''}`           // clave por pantalla (ruta)
      : ''
  );

  const cargar = useCallback(() => {
    if (cargadoNombre.current === uid.current) return;   // ya cargado para esta pantalla
    cargadoNombre.current = uid.current;
    getPreferencias()
      .then(r => {
        setData(r.data?.data || {});
        setEstaListo(true);
      })
      .catch(() => { setData({}); setEstaListo(true); });
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback((objeto) => {
    setData(prev => ({ ...prev, ...objeto }));
    savePreferencias(objeto).catch(() => {});
  }, []);

  return { data, cargar, guardar, estaListo };
}
