import { useState, useEffect, useRef, useCallback } from 'react';
import Spinner from './Spinner';
import { getCongregaciones } from '../../api/congregaciones';

const PAGE = 20;

/**
 * Lupa de búsqueda de congregaciones (modal).
 * Usa getCongregaciones(), el mismo recurso del módulo de Congregaciones.
 *
 * Props:
 *   abierto        boolean
 *   onCerrar       fn()
 *   onElegir       fn(item)
 *   codigoInicial  string — precarga el buscador con el código actual
 */
export default function SelectorCongregacion({
  abierto, onCerrar, onElegir, codigoInicial,
}) {
  const [q, setQ]           = useState('');
  const [lista, setLista]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const inputRef  = useRef(null);
  const codigoRef = useRef('');
  codigoRef.current = codigoInicial;

  useEffect(() => {
    if (!abierto) return;
    setQ(codigoRef.current || '');
    setPagina(1);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [abierto]);

  const buscar = useCallback(() => {
    setCargando(true);
    const params = { page: pagina, page_size: PAGE, ...(q.trim() && { search: q.trim() }) };
    getCongregaciones(params)
      .then(r => {
        setLista(r.data.results || r.data);
        setTotal(r.data.count || 0);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [q, pagina]);

  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(buscar, 250); // espera a que el usuario termine de escribir
    return () => clearTimeout(t);
  }, [abierto, buscar]);

  // Elige una congregación y cierra el modal.
  const elegir = useCallback((item) => {
    onElegir(item);
    onCerrar();
  }, [onElegir, onCerrar]);

  if (!abierto) return null;
  const totalPaginas = Math.ceil(total / PAGE);

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white py-2">
            <h6 className="modal-title">
              <i className="bi bi-search me-2"></i>Buscar congregación
            </h6>
            <button type="button" className="btn-close btn-close-white" onClick={onCerrar}></button>
          </div>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="input-group mb-3">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input ref={inputRef} className="form-control"
                placeholder="Código, nombre, dirección o pastor..."
                value={q} onChange={e => { setQ(e.target.value); setPagina(1); }} />
              {q && (
                <button className="btn btn-outline-secondary" onClick={() => { setQ(''); setPagina(1); }}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>

            {cargando ? <div className="py-4"><Spinner /></div>
              : lista.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-house-door display-6 d-block mb-2 text-muted"></i>
                  No se encontraron congregaciones
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-sm mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '110px' }}>Código</th>
                        <th>Nombre</th>
                        <th>Dirección</th>
                        <th>Pastor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(c => (
                        <tr key={c.codigo} style={{ cursor: 'pointer' }} onClick={() => elegir(c)}>
                          <td><span className="badge bg-dark font-monospace">{c.codigo}</span></td>
                          <td className="small fw-semibold">{c.nombre}</td>
                          <td className="small text-muted">{c.direccion || '—'}</td>
                          <td className="small text-muted">
                            {c.pastor_nombre
                              ? <><code className="me-1">{c.pastor}</code>{c.pastor_nombre}</>
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            {totalPaginas > 1 && (
              <div className="d-flex justify-content-between align-items-center mt-2">
                <span className="small text-muted">
                  {total} resultado(s) — página {pagina} de {totalPaginas}
                </span>
                <div className="btn-group btn-group-sm">
                  <button className="btn btn-outline-secondary" disabled={pagina === 1}
                    onClick={() => setPagina(p => p - 1)}><i className="bi bi-chevron-left"></i></button>
                  <button className="btn btn-outline-secondary" disabled={pagina >= totalPaginas}
                    onClick={() => setPagina(p => p + 1)}><i className="bi bi-chevron-right"></i></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
