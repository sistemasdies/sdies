import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { getCategorias, createCategoria, updateCategoria, deleteCategoria } from '../../api/activos';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const PAGE_SIZE = 50;
const FORM_VACIO = { categoria: '', nombre_categoria: '' };
const msgErr = (err, def) => err?.response?.data?.detail || err?.response?.data?.categoria?.[0] || err?.response?.data?.nombre_categoria?.[0] || def;

export default function CategoriasPage() {
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
    getCategorias(params).then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar las categorías'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);
  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setModal(true); };
  const abrirEditar = (c) => { setEditando(c); setForm({ categoria: c.categoria || '', nombre_categoria: c.nombre_categoria || '' }); setModal(true); };
  const guardar = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { categoria: form.categoria.trim().toUpperCase(), nombre_categoria: form.nombre_categoria.trim() };
      if (editando) { await updateCategoria(editando.categoria, payload); toast.success('Categoría actualizada'); }
      else { await createCategoria(payload); toast.success('Categoría creada'); }
      setModal(false); cargar();
    } catch (err) { toast.error(msgErr(err, 'Error al guardar la categoría')); }
    finally { setSaving(false); }
  };
  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar la categoría "${c.categoria} - ${c.nombre_categoria}"?`)) return;
    try { await deleteCategoria(c.categoria); toast.success('Categoría eliminada'); cargar(); }
    catch (err) { toast.error(msgErr(err, 'No se pudo eliminar la categoría')); }
  };
  const paginas = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <TopBar title="Categorías de Activos" />
      <div className="p-4">
        <PageHeader title="Categorías de Activos" subtitle={`${total} categoría${total === 1 ? '' : 's'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}><i className="bi bi-plus-lg me-1"></i>Nueva categoría</button>
        </PageHeader>
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
              <input className="form-control border-start-0" placeholder="Buscar por código o nombre..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
              {busqueda && <button className="btn btn-outline-secondary" onClick={() => { setBusqueda(''); setPagina(1); }}><i className="bi bi-x"></i></button>}
            </div>
          </div>
        </div>
        <div className="card border-0 shadow-sm">
          {loading ? <div className="card-body"><Spinner /></div> : lista.length === 0 ? (
            <div className="card-body"><EmptyState icon="bi-tags" title={busqueda ? 'Sin resultados' : 'Sin categorías'} subtitle={busqueda ? `No hay categorías que coincidan con "${busqueda}"` : 'Crea la primera categoría'} action={!busqueda && <button className="btn btn-success mt-2" onClick={abrirNuevo} disabled={!canAdd}><i className="bi bi-plus-lg me-1"></i>Crear ahora</button>} /></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark"><tr><th>Categoría</th><th>Nombre</th><th className="text-center">Acciones</th></tr></thead>
                <tbody>
                  {lista.map(c => (
                    <tr key={c.categoria}>
                      <td><span className="badge bg-dark font-monospace">{c.categoria}</span></td>
                      <td className="fw-semibold">{c.nombre_categoria}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-primary" onClick={() => abrirEditar(c)} disabled={!canEdit} title="Editar"><i className="bi bi-pencil"></i></button>
                          <button type="button" className="btn btn-outline-danger" onClick={() => eliminar(c)} disabled={!canDel} title="Eliminar"><i className="bi bi-trash"></i></button>
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
                <h5 className="modal-title"><i className="bi bi-tags me-2"></i>{editando ? 'Editar categoría' : 'Nueva categoría'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-4">
                      <label className="form-label small fw-semibold">Categoría <span className="text-danger">*</span></label>
                      <input className="form-control font-monospace text-uppercase" maxLength={3} value={form.categoria} required placeholder="Ej: COM"
                        disabled={!!editando} onChange={e => setForm({ ...form, categoria: e.target.value })} />
                    </div>
                    <div className="col-8">
                      <label className="form-label small fw-semibold">Nombre <span className="text-danger">*</span></label>
                      <input className="form-control" maxLength={30} value={form.nombre_categoria} required placeholder="Nombre de la categoría"
                        onChange={e => setForm({ ...form, nombre_categoria: e.target.value })} />
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
