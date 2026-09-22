import { useState, useRef, useEffect } from 'react';

/**
 * Desplegable de selección múltiple con chips, buscador y checkboxes.
 *
 * Props:
 *   options     array de objetos
 *   value       array de claves seleccionadas
 *   onChange    fn(nuevasClaves)
 *   getKey      fn(item) -> clave única (codigo/cedula)
 *   getLabel    fn(item) -> texto a mostrar
 *   placeholder texto cuando no hay selección
 */
export default function MultiSelect({ options = [], value = [], onChange, getKey, getLabel, placeholder = 'Todos' }) {
  const [abierto, setAbierto] = useState(false);
  const [q,       setQ]       = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const filtradas = options.filter(o =>
    (getLabel(o) || '').toLowerCase().includes(q.toLowerCase())
  );

  const toggle = (o) => {
    const k = getKey(o);
    onChange(value.includes(k) ? value.filter(v => v !== k) : [...value, k]);
  };

  return (
    <div ref={ref} className="position-relative">
      <div className="form-control form-control-sm d-flex flex-wrap align-items-center gap-1"
        style={{ minHeight: '31px', cursor: 'pointer', background: '#fff' }}
        onClick={() => setAbierto(a => !a)}>
        {value.length === 0
          ? <span className="text-muted small">{placeholder}</span>
          : <>
              {value.slice(0, 3).map(k => (
                <span key={k} className="badge bg-primary" style={{fontWeight:500}}>{k}</span>
              ))}
              {value.length > 3 && (
                <span className="badge bg-secondary" style={{fontWeight:500}}>+{value.length - 3}</span>
              )}
            </>}
        <span className="ms-auto small text-muted"><i className="bi bi-caret-down-fill"></i></span>
      </div>

      {abierto && (
        <div className="dropdown-menu show w-100 p-2"
          style={{ maxHeight: 240, overflowY: 'auto', cursor: 'default' }}>
          <input className="form-control form-control-sm mb-2" placeholder="Filtrar..."
            value={q} onChange={e => setQ(e.target.value)}
            onClick={e => e.stopPropagation()} autoComplete="off" />
          <div className="form-check small" onClick={e => e.stopPropagation()}>
            <input className="form-check-input" type="checkbox"
              checked={value.length === 0}
              onChange={() => onChange([])} id={`ms-todos-${placeholder}`} />
            <label className="form-check-label text-muted" htmlFor={`ms-todos-${placeholder}`}>
              Todos
            </label>
          </div>
          <hr className="my-1" />
          {filtradas.map(o => {
            const k    = getKey(o);
            const sel  = value.includes(k);
            return (
              <div key={k} className="form-check small" onClick={e => e.stopPropagation()}>
                <input className="form-check-input" type="checkbox" checked={sel}
                  onChange={() => toggle(o)} id={`ms-${placeholder}-${k}`} />
                <label className="form-check-label" htmlFor={`ms-${placeholder}-${k}`}
                  style={{ cursor: 'pointer' }}>
                  {getLabel(o)}
                </label>
              </div>
            );
          })}
          {filtradas.length === 0 && (
            <div className="text-muted small text-center py-2">Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
}
