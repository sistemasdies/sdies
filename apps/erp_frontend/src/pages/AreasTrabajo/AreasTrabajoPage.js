import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import {
  getAreasTrabajo, createAreaTrabajo, updateAreaTrabajo, deleteAreaTrabajo,
} from '../../api/areasTrabajo';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const PAGE_SIZE = 50;

const FORM_VACIO = { codigo_area: '', nombre_area: '', descripcion_area: '', comentarios_area: '' };

const mensajeError = (err, porDefecto) =>
  err?.response?.data?.detail
  || err?.response?.data?.codigo_area?.[0]
  || err?.response?.data?.nombre_area?.[0]
  || porDefecto;

export default function AreasTrabajoPage() {
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
    getAreasTrabajo(params)
      .then(r => {
        setLista(r.data.results || []);
        setTotal(r.data.count || 0);
      })
      .catch(() => toast.error('No se pudieron cargar las áreas de trabajo'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModal(true);
  };

  const abrirEditar = (a) => {
    setEditando(a);
    setForm({
      codigo_area: a.codigo_area || '',
      nombre_area: a.nombre_area || '',
      descripcion_area: a.descripcion_area || '',
      comentarios_area: a.comentarios_area || '',
    });
    setModal(true);
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload = {
        codigo_area: form.codigo_area.trim(),
        nombre_area: form.nombre_area.trim(),
        descripcion_area: form.descripcion_area.trim(),
        comentarios_area: form.comentarios_area.trim(),
      };
      if (editando) {
        await updateAreaTrabajo(editando.codigo_area, payload);
        toast.success('Área de trabajo actualizada');
      } else {
        await createAreaTrabajo(payload);
        toast.success('Área de trabajo creada');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'Error al guardar el área de trabajo'));
    } finally { setSaving(false); }
  };

  const eliminar = async (a) => {
    if (!window.confirm(`¿Eliminar el área "${a.codigo_area} - ${a.nombre_area}"?`)) return;
    try {
      await deleteAreaTrabajo(a.codigo_area);
      toast.success('Área de trabajo eliminada');
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar el área de trabajo'));
    }
  };

  const paginas = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <TopBar title="Áreas de Trabajo" />
      <div className="p-4">
        <PageHeader title="Áreas de Trabajo"
          subtitle={`${total} área${total === 1 ? '' : 's'} registrada${total === 1 ? '' : 's'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nueva área
          </button>
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input className="form-control border-start-0"
                placeholder="Buscar por código, nombre o descripción..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
              {busqueda && (
                <button className="btn btn-outline-secondary"
                  onClick={() => { setBusqueda(''); setPagina(1); }}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          {loading ? (
            <div className="card-body"><Spinner /></div>
          ) : lista.length === 0 ? (
            <div className="card-body">
              <EmptyState icon="bi-grid"
                title={busqueda ? 'Sin resultados' : 'Sin áreas de trabajo'}
                subtitle={busqueda
                  ? `No hay áreas que coincidan con "${busqueda}"`
                  : 'Crea la primera área con el botón de arriba'}
                action={!busqueda && (
                  <button className="btn btn-success mt-2" onClick={abrirNuevo} disabled={!canAdd}>
                    <i className="bi bi-plus-lg me-1"></i>Crear ahora
                  </button>
                )} />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(a => (
                    <tr key={a.codigo_area}>
                      <td>
                        <span className="badge bg-dark fs-6 fw-normal font-monospace">
                          {a.codigo_area}
                        </span>
                      </td>
                      <td className="fw-semibold">{a.nombre_area}</td>
                      <td className="small">{a.descripcion_area || '—'}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary"
                            onClick={() => abrirEditar(a)} title="Editar" disabled={!canEdit}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger"
                            onClick={() => eliminar(a)} title="Eliminar" disabled={!canDel}>
                            <i className="bi bi-trash"></i>
                          </button>
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
                <button className="btn btn-outline-secondary"
                  disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button className="btn btn-outline-secondary"
                  disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-grid me-2"></i>
                  {editando ? 'Editar área de trabajo' : 'Nueva área de trabajo'}
                </h5>
                <button className="btn-close btn-close-white"
                  onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">
                        Código <span className="text-danger">*</span>
                      </label>
                      <input className="form-control font-monospace"
                        maxLength={7} value={form.codigo_area} required
                        placeholder="Ej: ADM"
                        disabled={!!editando}
                        onChange={e => setForm({ ...form, codigo_area: e.target.value })} />
                      <div className="form-text">Máximo 7 caracteres, único</div>
                    </div>
                    <div className="col-md-9">
                      <label className="form-label small fw-semibold">
                        Nombre <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" maxLength={20} value={form.nombre_area} required
                        placeholder="Nombre del área"
                        onChange={e => setForm({ ...form, nombre_area: e.target.value })} />
                      <div className="form-text">Máximo 15 caracteres</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Descripción</label>
                      <input className="form-control" maxLength={100} value={form.descripcion_area}
                        placeholder="Descripción del área"
                        onChange={e => setForm({ ...form, descripcion_area: e.target.value })} />
                      <div className="form-text">Máximo 100 caracteres</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Comentarios</label>
                      <textarea className="form-control" rows={3} value={form.comentarios_area}
                        placeholder="Comentarios adicionales"
                        onChange={e => setForm({ ...form, comentarios_area: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
