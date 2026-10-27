import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import {
  getEstados, createEstado,
  updateEstado, deleteEstado,
} from '../../api/estados';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const PAGE_SIZE = 50;

const FORM_VACIO = { estado: '', descripcion: '' };

const mensajeError = (err, porDefecto) =>
  err?.response?.data?.detail
  || err?.response?.data?.estado?.[0]
  || err?.response?.data?.descripcion?.[0]
  || porDefecto;

export default function EstadosPage() {
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  const [lista,      setLista]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busqueda,   setBusqueda]   = useState('');
  const [pagina,     setPagina]     = useState(1);
  const [total,      setTotal]      = useState(0);

  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(FORM_VACIO);
  const [editando,   setEditando]   = useState(null);
  const [saving,     setSaving]     = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda.trim()) params.search = busqueda.trim();
    getEstados(params)
      .then(r => {
        setLista(r.data.results || []);
        setTotal(r.data.count || 0);
      })
      .catch(() => toast.error('No se pudieron cargar los estados'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModal(true);
  };

  const abrirEditar = (e) => {
    setEditando(e);
    setForm({
      estado: e.estado || '',
      descripcion: e.descripcion || '',
    });
    setModal(true);
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload = {
        estado: form.estado.trim(),
        descripcion: form.descripcion.trim(),
      };
      if (editando) {
        await updateEstado(editando.estado, payload);
        toast.success('Estado actualizado');
      } else {
        await createEstado(payload);
        toast.success('Estado creado');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'Error al guardar el estado'));
    } finally { setSaving(false); }
  };

  const eliminar = async (e) => {
    if (!window.confirm(`¿Eliminar el estado "${e.estado} - ${e.descripcion}"?`)) return;
    try {
      await deleteEstado(e.estado);
      toast.success('Estado eliminado');
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar el estado'));
    }
  };

  const paginas = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <TopBar title="Estados" />
      <div className="p-4">
        <PageHeader title="Estados"
          subtitle={`${total} estado${total === 1 ? '' : 's'} registrado${total === 1 ? '' : 's'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo estado
          </button>
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input className="form-control border-start-0"
                placeholder="Buscar por código o descripción..."
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
              <EmptyState icon="bi-tags"
                title={busqueda ? 'Sin resultados' : 'Sin estados'}
                subtitle={busqueda
                  ? `No hay estados que coincidan con "${busqueda}"`
                  : 'Crea el primer estado con el botón de arriba'}
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
                    <th>Estado</th>
                    <th>Descripción</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(e => (
                    <tr key={e.estado}>
                      <td>
                        <span className="badge bg-dark fs-6 fw-normal font-monospace">
                          {e.estado}
                        </span>
                      </td>
                      <td className="fw-semibold">{e.descripcion}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary"
                            onClick={() => abrirEditar(e)} title="Editar" disabled={!canEdit}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger"
                            onClick={() => eliminar(e)} title="Eliminar" disabled={!canDel}>
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
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-tags me-2"></i>
                  {editando ? 'Editar estado' : 'Nuevo estado'}
                </h5>
                <button className="btn-close btn-close-white"
                  onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-4">
                      <label className="form-label small fw-semibold">
                        Estado <span className="text-danger">*</span>
                      </label>
                      <input className="form-control font-monospace text-uppercase"
                        maxLength={1} value={form.estado} required
                        placeholder="Ej: 9"
                        disabled={!!editando}
                        onChange={e => setForm({ ...form, estado: e.target.value })} />
                      <div className="form-text">1 carácter, único</div>
                    </div>
                    <div className="col-8">
                      <label className="form-label small fw-semibold">
                        Descripción <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" maxLength={15} value={form.descripcion} required
                        placeholder="Descripción del estado"
                        onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                      <div className="form-text">Máximo 15 caracteres</div>
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
