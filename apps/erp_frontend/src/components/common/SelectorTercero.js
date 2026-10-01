import { useState, useEffect, useRef, useCallback } from 'react';
import Spinner from './Spinner';
import { getTerceros } from '../../api/terceros';

const PAGE = 20;

/**
 * Lupa de búsqueda de terceros (modal).
 * Misma implementación que usa Membresía: reutiliza getTerceros(), el método
 * del módulo de Terceros, con búsqueda por cédula, nombre, apellido o celular.
 *
 * Props:
 *   abierto             boolean
 *   onCerrar            fn()
 *   onElegir            fn(item, reservado)
 *   cedulaInicial       string — precarga el buscador con la cédula actual
 *   cargarReservados    fn() => Promise<array> — opcional. Si se pasa, marca
 *                       las cédulas que ya están usadas con un badge.
 */
export default function SelectorTercero({
  abierto, onCerrar, onElegir, cedulaInicial, cargarReservados,
}) {
  const [q, setQ]         = useState('');
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando]       = useState(false);
  const [reservados, setReservados]   = useState(() => new Set());
  const inputRef  = useRef(null);
  const cedulaRef = useRef('');
  cedulaRef.current = cedulaInicial;

  useEffect(() => {
    if (!abierto) return;
    setQ(cedulaRef.current || '');
    setPagina(1);
    if (cargarReservados) {
      Promise.resolve(cargarReservados())
        .then(r => setReservados(new Set(r || [])))
        .catch(() => setReservados(new Set()));
    } else {
      setReservados(new Set());
    }
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [abierto]);

  const buscar = useCallback(() => {
    setCargando(true);
    const params = { page: pagina, page_size: PAGE, ...(q.trim() && { search: q.trim() }) };
    getTerceros(params)
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

  // Elige un tercero y cierra el modal. onElegir recibe (item, reservado).
  const elegir = useCallback((item) => {
    onElegir(item, reservados.has(item.cedula));
    onCerrar();
  }, [onElegir, onCerrar, reservados]);

  if (!abierto) return null;
  const totalPaginas = Math.ceil(total / PAGE);

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-dark text-white py-2">
            <h6 className="modal-title">
              <i className="bi bi-search me-2"></i>Buscar tercero
            </h6>
            <button type="button" className="btn-close btn-close-white" onClick={onCerrar}></button>
          </div>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="input-group mb-3">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input ref={inputRef} className="form-control"
                placeholder="Cédula, nombre, apellido o celular..."
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
                  <i className="bi bi-person-x display-6 d-block mb-2 text-muted"></i>
                  No se encontraron terceros
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-sm mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Cédula</th><th>Nombre</th><th>Celular</th>
                        {cargarReservados && <th className="text-center">Estado</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(t => (
                        <tr key={t.cedula} style={{ cursor: 'pointer' }}
                          onClick={() => elegir(t)}>
                          <td><code className="small">{t.cedula}</code></td>
                          <td className="small">{t.nombre_completo}</td>
                          <td className="small">{t.celular || '—'}</td>
                          {cargarReservados && (
                            <td className="text-center">
                              {reservados.has(t.cedula)
                                ? <span className="badge bg-warning text-dark">Ya tiene membresía</span>
                                : <span className="badge bg-success">Disponible</span>}
                            </td>
                          )}
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
