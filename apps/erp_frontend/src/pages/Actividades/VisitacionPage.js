import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import SelectorCongregacion from '../../components/common/SelectorCongregacion';
import SelectorMembresia from '../../components/common/SelectorMembresia';
import { usePerm } from '../../hooks/usePerm';
import {
  getVisitaciones, createVisitacion, updateVisitacion, deleteVisitacion,
} from '../../api/actividades';
import { getCongregaciones } from '../../api/congregaciones';
import { formatDate } from '../../utils/formato';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;
const FORM_VACIO = {
  id: '', item: '', fecha: '', congregacion: '', modo: '1',
  visitado: '', visitado_cedula: '', visitado_nombre: '',
  objeto_visita: '', comentarios: '',
  responsable: '', responsable_cedula: '', responsable_nombre: '',
};

export default function VisitacionPage() {
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orden, setOrden] = useState({ campo: 'fecha', dir: 'desc' });

  const [congregaciones, setCongregaciones] = useState([]);
  const [selectorCong, setSelectorCong] = useState(false);
  const [selectorVisitado, setSelectorVisitado] = useState(false);
  const [selectorResponsable, setSelectorResponsable] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = {
      page: pagina, page_size: PAGE_SIZE,
      ordering: `${orden.dir === 'desc' ? '-' : ''}${orden.campo}`,
    };
    if (busqueda.trim()) params.search = busqueda.trim();
    getVisitaciones(params)
      .then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar las visitaciones'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda, orden]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    getCongregaciones({ page_size: 1000 })
      .then(r => setCongregaciones(r.data.results || r.data || []))
      .catch(() => {});
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...FORM_VACIO, fecha: new Date().toISOString().split('T')[0] });
    setModal(true);
  };

  const abrirEditar = (v) => {
    setEditando(v);
    setForm({
      id: v.id,
      item: v.item || '',
      fecha: v.fecha || '',
      congregacion: v.congregacion || '',
      modo: v.modo || '1',
      visitado: v.visitado || '',
      visitado_cedula: v.visitado_cedula || '',
      visitado_nombre: v.visitado_nombre || '',
      objeto_visita: v.objeto_visita || '',
      comentarios: v.comentarios || '',
      responsable: v.responsable || '',
      responsable_cedula: v.responsable_cedula || '',
      responsable_nombre: v.responsable_nombre || '',
    });
    setModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.fecha || !form.congregacion || !form.visitado || !form.responsable) {
      toast.error('La fecha, congregación, visitado y responsable son obligatorios');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        fecha: form.fecha,
        congregacion: form.congregacion,
        modo: form.modo,
        visitado: form.visitado,
        responsable: form.responsable,
        objeto_visita: form.objeto_visita,
        comentarios: form.comentarios,
      };
      if (editando) {
        await updateVisitacion(editando.id, payload);
        toast.success('Visitación actualizada');
      } else {
        await createVisitacion(payload);
        toast.success('Visitación creada');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (v) => {
    if (!window.confirm(`¿Eliminar la visitación #${v.item} del ${formatDate(v.fecha)}?`)) return;
    try {
      await deleteVisitacion(v.id);
      toast.success('Visitación eliminada');
      cargar();
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const totalPaginas = Math.ceil(total / PAGE_SIZE);
  const nombreCongregacion = (cod) => congregaciones.find(c => c.codigo === cod)?.nombre || cod;

  const cambiarOrden = (campo) => {
    setOrden(o => ({ campo, dir: o.campo === campo && o.dir === 'asc' ? 'desc' : 'asc' }));
    setPagina(1);
  };

  const iconoOrden = (campo) => {
    if (orden.campo !== campo) return <i className="bi bi-arrow-down-up text-muted opacity-50 ms-1 small"></i>;
    return <i className={`bi bi-arrow-${orden.dir === 'asc' ? 'up' : 'down'} ms-1 small`}></i>;
  };

  const setMiembro = (campo, item) => {
    setForm(f => ({
      ...f,
      [campo]: item.id,
      [`${campo}_cedula`]: item.tercero?.cedula || '',
      [`${campo}_nombre`]: item.nombre_completo || '',
    }));
  };

  return (
    <MainLayout>
      <TopBar title="Visitación" />
      <div className="p-4">
        <PageHeader title="Visitación" subtitle="Registro de visitas a miembros">
          {canAdd && (
            <button className="btn btn-success btn-sm" onClick={abrirNuevo}>
              <i className="bi bi-plus-lg me-2"></i>Nueva visitación
            </button>
          )}
        </PageHeader>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input className="form-control form-control-sm" placeholder="Buscar por objeto, comentarios o persona..."
                value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
              {busqueda && (
                <button className="btn btn-outline-secondary btn-sm" onClick={() => { setBusqueda(''); setPagina(1); }}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? <div className="py-5"><Spinner /></div>
          : lista.length === 0 ? (
            <EmptyState icon="bi-house-door" title="Sin registros" subtitle="No hay visitaciones registradas" />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => cambiarOrden('fecha')}>
                        Fecha {iconoOrden('fecha')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => cambiarOrden('congregacion')}>
                        Congregación {iconoOrden('congregacion')}
                      </th>
                      <th>Item</th>
                      <th>Modo</th>
                      <th>Visitado</th>
                      <th>Responsable</th>
                      <th>Objeto</th>
                      <th>Comentarios</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(v => (
                      <tr key={v.id}>
                        <td>{formatDate(v.fecha)}</td>
                        <td><code className="me-1">{v.congregacion}</code>{v.congregacion_nombre}</td>
                        <td>{v.item}</td>
                        <td>{v.modo_label}</td>
                        <td className="small">{v.visitado_cedula} — {v.visitado_nombre}</td>
                        <td className="small">{v.responsable_cedula} — {v.responsable_nombre}</td>
                        <td className="small">{v.objeto_visita || '—'}</td>
                        <td className="small text-muted">{v.comentarios || '—'}</td>
                        <td className="text-center">
                          {canEdit && (
                            <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrirEditar(v)}>
                              <i className="bi bi-pencil"></i>
                            </button>
                          )}
                          {canDel && (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => eliminar(v)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPaginas > 1 && (
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-muted">{total} resultado(s) — página {pagina} de {totalPaginas}</span>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-secondary" disabled={pagina === 1}
                      onClick={() => setPagina(p => p - 1)}><i className="bi bi-chevron-left"></i></button>
                    <button className="btn btn-outline-secondary" disabled={pagina >= totalPaginas}
                      onClick={() => setPagina(p => p + 1)}><i className="bi bi-chevron-right"></i></button>
                  </div>
                </div>
              )}
            </>
          )}
      </div>

      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className={`bi ${editando ? 'bi-pencil' : 'bi-plus-lg'} me-2`}></i>
                  {editando ? 'Editar visitación' : 'Nueva visitación'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Fecha <span className="text-danger">*</span></label>
                      <input type="date" className="form-control" required
                        value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Congregación <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input className="form-control font-monospace" required readOnly
                          value={form.congregacion} placeholder="Código" />
                        <button type="button" className="btn btn-outline-success" onClick={() => setSelectorCong(true)}>
                          <i className="bi bi-search"></i>
                        </button>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Item</label>
                      <input className="form-control font-monospace" readOnly value={form.item || '—'} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Modo <span className="text-danger">*</span></label>
                      <select className="form-select" value={form.modo}
                        onChange={e => setForm(f => ({ ...f, modo: e.target.value }))}>
                        <option value="1">Presencial</option>
                        <option value="2">Virtual</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Visitado <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input className="form-control" readOnly
                          value={form.visitado ? `${form.visitado_cedula} — ${form.visitado_nombre}` : ''}
                          placeholder="Seleccione un miembro" />
                        <button type="button" className="btn btn-outline-success" onClick={() => setSelectorVisitado(true)}>
                          <i className="bi bi-search"></i>
                        </button>
                        {form.visitado && (
                          <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(f => ({ ...f, visitado: '', visitado_cedula: '', visitado_nombre: '' }))}>
                            <i className="bi bi-x"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Responsable <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input className="form-control" readOnly
                          value={form.responsable ? `${form.responsable_cedula} — ${form.responsable_nombre}` : ''}
                          placeholder="Seleccione un miembro" />
                        <button type="button" className="btn btn-outline-success" onClick={() => setSelectorResponsable(true)}>
                          <i className="bi bi-search"></i>
                        </button>
                        {form.responsable && (
                          <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(f => ({ ...f, responsable: '', responsable_cedula: '', responsable_nombre: '' }))}>
                            <i className="bi bi-x"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Objeto de la visita</label>
                      <input type="text" maxLength={50} className="form-control"
                        value={form.objeto_visita} onChange={e => setForm(f => ({ ...f, objeto_visita: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Comentarios</label>
                      <textarea className="form-control" rows={3}
                        value={form.comentarios} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-check-lg me-2"></i>}
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <SelectorCongregacion
        abierto={selectorCong}
        codigoInicial={form.congregacion}
        onCerrar={() => setSelectorCong(false)}
        onElegir={c => setForm(f => ({ ...f, congregacion: c.codigo }))} />

      <SelectorMembresia
        abierto={selectorVisitado}
        cedulaInicial={form.visitado_cedula}
        congregacion={form.congregacion}
        onCerrar={() => setSelectorVisitado(false)}
        onElegir={item => setMiembro('visitado', item)} />

      <SelectorMembresia
        abierto={selectorResponsable}
        cedulaInicial={form.responsable_cedula}
        congregacion={form.congregacion}
        onCerrar={() => setSelectorResponsable(false)}
        onElegir={item => setMiembro('responsable', item)} />
    </MainLayout>
  );
}
