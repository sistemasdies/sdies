import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { getAuditLogs } from '../../api/audit';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

export default function AuditoriaPage() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [recurso, setRecurso] = useState('');
  const [accion, setAccion] = useState('');
  const [usuario, setUsuario] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (recurso) params.resource = recurso;
    if (accion) params.action = accion;
    if (usuario.trim()) params.user = usuario.trim();
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    getAuditLogs(params)
      .then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar los logs'))
      .finally(() => setLoading(false));
  }, [pagina, recurso, accion, usuario, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const paginas = Math.ceil(total / PAGE_SIZE);

  const fmt = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  return (
    <MainLayout>
      <TopBar title="Auditoría — Logs" />
      <div className="p-4">
        <PageHeader title="Logs de Auditoría" subtitle={`${total} registro${total === 1 ? '' : 's'}`} />

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2">
              <div className="col-md-2">
                <input className="form-control form-control-sm" placeholder="Recurso (ej: tercero)" value={recurso} onChange={e => { setRecurso(e.target.value); setPagina(1); }} />
              </div>
              <div className="col-md-2">
                <select className="form-select form-select-sm" value={accion} onChange={e => { setAccion(e.target.value); setPagina(1); }}>
                  <option value="">Todas las acciones</option>
                  <option value="create">create</option>
                  <option value="update">update</option>
                  <option value="delete">delete</option>
                </select>
              </div>
              <div className="col-md-2">
                <input className="form-control form-control-sm" placeholder="Usuario (login)" value={usuario} onChange={e => { setUsuario(e.target.value); setPagina(1); }} />
              </div>
              <div className="col-md-2">
                <input type="date" className="form-control form-control-sm" value={desde} onChange={e => { setDesde(e.target.value); setPagina(1); }} />
              </div>
              <div className="col-md-2">
                <input type="date" className="form-control form-control-sm" value={hasta} onChange={e => { setHasta(e.target.value); setPagina(1); }} />
              </div>
              <div className="col-md-2">
                <button className="btn btn-sm btn-outline-secondary w-100" onClick={() => { setRecurso(''); setAccion(''); setUsuario(''); setDesde(''); setHasta(''); setPagina(1); }}>Limpiar</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          {loading ? <div className="card-body"><Spinner /></div> : lista.length === 0 ? (
            <div className="card-body"><EmptyState icon="bi-shield-check" title="Sin logs" subtitle="No hay registros de auditoría" /></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark">
                  <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Recurso</th><th>ID</th><th>IP</th><th className="text-center">Detalle</th></tr>
                </thead>
                <tbody>
                  {lista.map(l => (
                    <tr key={l.id}>
                      <td className="small">{l.timestamp}</td>
                      <td className="small">{l.user_nombre || l.user_login || l.user || '—'}</td>
                      <td className="small"><span className={`badge bg-${l.action === 'create' ? 'success' : l.action === 'update' ? 'primary' : 'danger'}`}>{l.action}</span></td>
                      <td className="small">{l.resource}</td>
                      <td className="small"><code>{l.resource_id}</code></td>
                      <td className="small">{l.ip_address || '—'}</td>
                      <td className="text-center">
                        <button type="button" className="btn btn-sm btn-outline-info" onClick={() => setDetalle(l)} title="Ver detalle">
                          <i className="bi bi-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {paginas > 1 && (
            <div className="card-footer d-flex justify-content-between align-items-center bg-white">
              <span className="small text-muted">Página {pagina} de {paginas}</span>
              <div className="btn-group btn-group-sm">
                <button className="btn btn-outline-secondary" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}><i className="bi bi-chevron-left"></i></button>
                <button className="btn btn-outline-secondary" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}><i className="bi bi-chevron-right"></i></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detalle && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><i className="bi bi-shield-check me-2"></i>Detalle del log</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDetalle(null)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <div className="mb-2"><strong>Usuario:</strong> {detalle.user_nombre || detalle.user_login || detalle.user || '—'}</div>
                <div className="mb-2"><strong>Acción:</strong> {detalle.action}</div>
                <div className="mb-2"><strong>Recurso:</strong> {detalle.resource} / {detalle.resource_id}</div>
                <div className="mb-2"><strong>Endpoint:</strong> {detalle.endpoint} ({detalle.http_method})</div>
                <div className="mb-2"><strong>IP / UA:</strong> {detalle.ip_address || '—'} — {detalle.user_agent || '—'}</div>
                <div className="mb-2"><strong>Antes:</strong></div>
                <pre className="bg-light p-2 small" style={{ whiteSpace: 'pre-wrap' }}>{fmt(detalle.before_data)}</pre>
                <div className="mb-2"><strong>Después:</strong></div>
                <pre className="bg-light p-2 small" style={{ whiteSpace: 'pre-wrap' }}>{fmt(detalle.after_data)}</pre>
                {detalle.extra && Object.keys(detalle.extra).length > 0 && (
                  <>
                    <div className="mb-2"><strong>Extra:</strong></div>
                    <pre className="bg-light p-2 small" style={{ whiteSpace: 'pre-wrap' }}>{fmt(detalle.extra)}</pre>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
