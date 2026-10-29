import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { getUbicaciones, createUbicacion, updateUbicacion, deleteUbicacion } from '../../api/activos';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const PAGE_SIZE = 50;
const FORM_VACIO = { ubicacion: '', descripcion: '' };
const msgErr = (err, def) => err?.response?.data?.detail || err?.response?.data?.ubicacion?.[0] || err?.response?.data?.descripcion?.[0] || def;

export default function UbicacionesPage() {
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

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda.trim()) params.search = busqueda.trim();
    getUbicaciones(params).then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar las ubicaciones'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);
  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setModal(true); };
  const abrirEditar = (u) => { setEditando(u); setForm({ ubicacion: u.ubicacion || '', descripcion: u.descripcion || '' }); setModal(true); };
  const guardar = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ubicacion: form.ubicacion.trim().toUpperCase(), descripcion: form.descripcion.trim() };
      if (editando) { await updateUbicacion(editando.ubicacion, payload); toast.success('Ubicación actualizada'); }
      else { await createUbicacion(payload); toast.success('Ubicación creada'); }
      setModal(false); cargar();
    } catch (err) { toast.error(msgErr(err, 'Error al guardar la ubicación')); }
    finally { setSaving(false); }
  };
  const eliminar = async (u) => {
    if (!window.confirm(`¿Eliminar la ubicación "${u.ubicacion} - ${u.descripcion}"?`)) return;
    try { await deleteUbicacion(u.ubicacion); toast.success('Ubicación eliminada'); cargar(); }
    catch (err) { toast.error(msgErr(err, 'No se pudo eliminar la ubicación')); }
  };
  const paginas = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <TopBar title="Ubicaciones" />
      <div className="p-4">
        <PageHeader title="Ubicaciones" subtitle={`${total} ubicación${total === 1 ? '' : 'es'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}><i className="bi bi-plus-lg me-1"></i>Nueva ubicación</button>
        </PageHeader>
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
              <input className="form-control border-start-0" placeholder="Buscar por código o descripción..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
              {busqueda && <button className="btn btn-outline-secondary" onClick={() => { setBusqueda(''); setPagina(1); }}><i className="bi bi-x"></i></button>}
            </div>
          </div>
        </div>
        <div className="card border-0 shadow-sm">
          {loading ? <div className="card-body"><Spinner /></div> : lista.length === 0 ? (
            <div className="card-body"><EmptyState icon="bi-geo-alt" title={busqueda ? 'Sin resultados' : 'Sin ubicaciones'} subtitle={busqueda ? `No hay ubicaciones que coincidan con "${busqueda}"` : 'Crea la primera ubicación'} action={!busqueda && <button className="btn btn-success mt-2" onClick={abrirNuevo} disabled={!canAdd}><i className="bi bi-plus-lg me-1"></i>Crear ahora</button>} /></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark"><tr><th>Ubicación</th><th>Descripción</th><th className="text-center">Acciones</th></tr></thead>
                <tbody>
                  {lista.map(u => (
                    <tr key={u.ubicacion}>
                      <td><span className="badge bg-dark font-monospace">{u.ubicacion}</span></td>
                      <td className="fw-semibold">{u.descripcion}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-primary" onClick={() => abrirEditar(u)} disabled={!canEdit} title="Editar"><i className="bi bi-pencil"></i></button>
                          <button type="button" className="btn btn-outline-danger" onClick={() => eliminar(u)} disabled={!canDel} title="Eliminar"><i className="bi bi-trash"></i></button>
                        </div>
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
      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><i className="bi bi-geo-alt me-2"></i>{editando ? 'Editar ubicación' : 'Nueva ubicación'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-4">
                      <label className="form-label small fw-semibold">Ubicación <span className="text-danger">*</span></label>
                      <input className="form-control font-monospace text-uppercase" maxLength={4} value={form.ubicacion} required placeholder="Ej: BOD1"
                        disabled={!!editando} onChange={e => setForm({ ...form, ubicacion: e.target.value })} />
                    </div>
                    <div className="col-8">
                      <label className="form-label small fw-semibold">Descripción <span className="text-danger">*</span></label>
                      <input className="form-control" maxLength={20} value={form.descripcion} required placeholder="Descripción"
                        onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
