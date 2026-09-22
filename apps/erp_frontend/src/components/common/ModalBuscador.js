import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Modal de búsqueda reutilizable.
 * Se abre con F3 o Ctrl+F en el campo que tenga data-buscador="tipo"
 *
 * Props:
 *   show        boolean
 *   tipo        'cuenta' | 'tercero' | 'cc' | 'comprobante'
 *   datos       array de objetos a buscar
 *   onSelect    fn(item) — el item seleccionado
 *   onClose     fn()
 */

const CONFIGS = {
  cuenta: {
    titulo:      'Buscar cuenta contable',
    icon:        'bi-diagram-3',
    color:       'success',
    campos:      [
      { key: 'codigo',      label: 'Código',      ancho: '120px' },
      { key: 'descripcion', label: 'Descripción', ancho: 'auto'  },
      { key: 'nivel',       label: 'Niv.',         ancho: '60px'  },
      { key: 'naturaleza',  label: 'Nat.',         ancho: '60px'  },
    ],
    filtrar: (item, q) =>
      item.codigo?.toLowerCase().includes(q) ||
      item.descripcion?.toLowerCase().includes(q),
    // Validar al seleccionar — solo cuentas de detalle
    validar: (item) =>
      item.es_detalle === true
        ? null
        : 'Esta cuenta no es de detalle, seleccione otra cuenta.',
    valorDisplay: (item) => item.codigo,
    subDisplay:   (item) => item.descripcion,
  },
  tercero: {
    titulo:  'Buscar tercero',
    icon:    'bi-people',
    color:   'primary',
    campos:  [
      { key: 'cedula',          label: 'Cédula/NIT',   ancho: '130px' },
      { key: 'nombre_completo', label: 'Nombre / Razón social', ancho: 'auto' },
      { key: 'tipo_documento',  label: 'Tipo',          ancho: '70px'  },
    ],
    filtrar: (item, q) =>
      item.cedula?.toLowerCase().includes(q) ||
      item.nombre_completo?.toLowerCase().includes(q) ||
      item.razon_social?.toLowerCase().includes(q),
    valorDisplay: (item) => item.cedula,
    subDisplay:   (item) => item.nombre_completo,
  },
  cc: {
    titulo:  'Buscar centro de costo',
    icon:    'bi-bullseye',
    color:   'warning',
    campos:  [
      { key: 'codigo',      label: 'Código',      ancho: '100px' },
      { key: 'descripcion', label: 'Descripción', ancho: 'auto'  },
    ],
    filtrar: (item, q) =>
      item.codigo?.toLowerCase().includes(q) ||
      item.descripcion?.toLowerCase().includes(q),
    valorDisplay: (item) => item.codigo,
    subDisplay:   (item) => item.descripcion,
  },
  comprobante: {
    titulo:  'Buscar comprobante',
    icon:    'bi-receipt',
    color:   'info',
    campos:  [
      { key: 'codigo',      label: 'Código',      ancho: '100px' },
      { key: 'descripcion', label: 'Descripción', ancho: 'auto'  },
    ],
    filtrar: (item, q) =>
      item.codigo?.toLowerCase().includes(q) ||
      item.descripcion?.toLowerCase().includes(q),
    valorDisplay: (item) => item.codigo,
    subDisplay:   (item) => item.descripcion,
  },
};

export default function ModalBuscador({ show, tipo, datos = [], onSelect, onClose }) {
  const [busqueda,  setBusqueda]  = useState('');
  const [selIdx,    setSelIdx]    = useState(0);
  const [errorSel,  setErrorSel]  = useState('');  // mensaje de validación al seleccionar
  const inputRef  = useRef(null);
  const listaRef  = useRef(null);

  const cfg = CONFIGS[tipo] || CONFIGS.cuenta;

  const filtrados = datos.filter(item =>
    cfg.filtrar(item, busqueda.toLowerCase())
  ).slice(0, 500);

  // Resetear al abrir
  useEffect(() => {
    if (show) {
      setBusqueda('');
      setSelIdx(0);
      setErrorSel('');
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [show, tipo]);

  // Scroll al elemento seleccionado
  useEffect(() => {
    const el = listaRef.current?.children[selIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selIdx]);

  const seleccionar = useCallback((item) => {
    // Validar si el config tiene una función validar (ej: cuentas de detalle)
    if (cfg.validar) {
      const error = cfg.validar(item);
      if (error) {
        setErrorSel(error);
        return; // no cierra, no selecciona
      }
    }
    setErrorSel('');
    onSelect(item);
    onClose();
  }, [onSelect, onClose, cfg]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelIdx(i => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtrados[selIdx]) seleccionar(filtrados[selIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Resetear selección al buscar
  const onBusquedaChange = (e) => {
    setBusqueda(e.target.value);
    setSelIdx(0);
  };

  if (!show) return null;

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content shadow-lg border-0">

          {/* Header */}
          <div className={`modal-header bg-${cfg.color} text-white py-2`}>
            <h6 className="modal-title mb-0">
              <i className={`bi ${cfg.icon} me-2`}></i>
              {cfg.titulo}
              <span className="badge bg-white bg-opacity-25 ms-2" style={{fontSize:11}}>
                F3
              </span>
            </h6>
            <button className="btn-close btn-close-white btn-sm" onClick={onClose}></button>
          </div>

          {/* Buscador */}
          <div className="px-3 pt-3 pb-2 border-bottom">
            <div className="input-group">
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                ref={inputRef}
                className="form-control"
                placeholder="Escriba para filtrar... (↑↓ navegar, Enter seleccionar, Esc cerrar)"
                value={busqueda}
                onChange={onBusquedaChange}
                onKeyDown={onKeyDown}
                autoComplete="off"
              />
              {busqueda && (
                <button className="btn btn-outline-secondary"
                  onClick={() => { setBusqueda(''); setSelIdx(0); inputRef.current?.focus(); }}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
            <div className="text-muted small mt-1 ps-1">
              {filtrados.length} resultado(s)
              {busqueda && ` para "${busqueda}"`}
            </div>
            {/* Mensaje de validación al intentar seleccionar */}
            {errorSel && (
              <div className="alert alert-warning d-flex align-items-center gap-2 py-2 px-3 mt-2 mb-0">
                <i className="bi bi-exclamation-triangle-fill text-warning flex-shrink-0"></i>
                <span className="small fw-semibold">{errorSel}</span>
              </div>
            )}
          </div>

          {/* Lista resultados */}
          <div className="modal-body p-0" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            {filtrados.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-search display-5 d-block mb-2 opacity-25"></i>
                <p className="mb-0">Sin resultados para <strong>"{busqueda}"</strong></p>
              </div>
            ) : (
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    {cfg.campos.map(c => (
                      <th key={c.key} style={{ width: c.ancho }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody ref={listaRef}>
                  {filtrados.map((item, idx) => {
                    const noValida    = cfg.validar ? cfg.validar(item) !== null : false;
                    const esSeleccionada = idx === selIdx;
                    return (
                      <tr
                        key={item.id || item.codigo || idx}
                        className={esSeleccionada ? `table-${cfg.color}` : ''}
                        style={{ cursor: noValida ? 'not-allowed' : 'pointer' }}
                        onClick={() => { setErrorSel(''); seleccionar(item); }}
                        onMouseEnter={() => { setSelIdx(idx); setErrorSel(''); }}
                      >
                        {cfg.campos.map(c => (
                          <td key={c.key} className="small"
                            style={noValida ? { fontWeight: 700 } : {}}>
                            {c.key === 'codigo' || c.key === 'cedula'
                              ? <code style={noValida ? { fontWeight: 700 } : {}}>
                                  {item[c.key] || '—'}
                                </code>
                              : <span>
                                  {item[c.key] || '—'}
                                  {noValida && c.key === 'descripcion' && (
                                    <span className="badge bg-secondary ms-2"
                                      style={{fontSize:9}}>no detalle</span>
                                  )}
                                </span>
                            }
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer py-2 border-top">
            <div className="text-muted small flex-grow-1">
              <i className="bi bi-keyboard me-1"></i>
              <kbd>↑↓</kbd> navegar &nbsp;
              <kbd>Enter</kbd> seleccionar &nbsp;
              <kbd>Esc</kbd> cerrar
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}