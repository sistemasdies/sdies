import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para manejar el modal buscador con F3.
 *
 * Uso:
 *   const buscador = useBuscador();
 *   <input onKeyDown={e => buscador.onKeyDown(e, 'cuenta', idx)} />
 *   <ModalBuscador {...buscador.modalProps('cuenta', cuentas, (item) => { ... })} />
 */
export function useBuscador() {
  const [estado, setEstado] = useState({
    show:     false,
    tipo:     null,
    contexto: null, // info extra (ej: índice de línea)
    onSelect: null,
  });

  const abrir = useCallback((tipo, contexto, onSelect) => {
    setEstado({ show: true, tipo, contexto, onSelect });
  }, []);

  const cerrar = useCallback(() => {
    setEstado(prev => ({ ...prev, show: false }));
  }, []);

  /**
   * Manejador de teclado para el campo input.
   * Llama a abrir() cuando el usuario presiona F3.
   *
   * @param e         evento de teclado
   * @param tipo      'cuenta' | 'tercero' | 'cc' | 'comprobante'
   * @param contexto  dato extra (índice de línea, etc.)
   * @param onSelect  función que recibe el item seleccionado
   */
  const onKeyDown = useCallback((e, tipo, contexto, onSelect) => {
    if (e.key === 'F3') {
      e.preventDefault();
      abrir(tipo, contexto, onSelect);
    }
  }, [abrir]);

  /**
   * Props listos para pasar a <ModalBuscador />
   */
  const modalProps = useCallback((datos, onSelectFn) => ({
    show:     estado.show,
    tipo:     estado.tipo,
    datos,
    onSelect: (item) => {
      // Llamar el callback registrado al abrir, o el pasado aquí
      const fn = estado.onSelect || onSelectFn;
      if (fn) fn(item, estado.contexto);
      cerrar();
    },
    onClose: cerrar,
  }), [estado, cerrar]);

  return { abrir, cerrar, onKeyDown, modalProps, estado };
}
