import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import {
  getCargos, createCargo, updateCargo, deleteCargo, siguienteCodigoCargo,
} from '../../api/cargos';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const PAGE_SIZE = 50;

const FORM_VACIO = { codigo_cargo: '', nombre_cargo: '' };

const mensajeError = (err, porDefecto) =>
  err?.response?.data?.detail
  || err?.response?.data?.codigo_cargo?.[0]
  || err?.response?.data?.nombre_cargo?.[0]
  || porDefecto;

export default function CargosPage() {
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
    getCargos(params)
      .then(r => {
        setLista(r.data.results || []);
        setTotal(r.data.count || 0);
      })
      .catch(() => toast.error('No se pudieron cargar los cargos'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModal(true);
  };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({
      codigo_cargo: c.codigo_cargo || '',
      nombre_cargo: c.nombre_cargo || '',
    });
    setModal(true);
  };

  const generarCodigo = async () => {
    try {
      const r = await siguienteCodigoCargo();
      setForm(f => ({ ...f, codigo_cargo: r.data.siguiente_codigo }));
    } catch {
      toast.error('No se pudo generar el código');
    }
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload = {
        codigo_cargo: form.codigo_cargo.trim().toUpperCase(),
        nombre_cargo: form.nombre_cargo.trim(),
      };
      if (editando) {
        await updateCargo(editando.codigo_cargo, payload);
        toast.success('Cargo actualizado');
      } else {
        await createCargo(payload);
        toast.success('Cargo creado');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'Error al guardar el cargo'));
    } finally { setSaving(false); }
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar el cargo "${c.codigo_cargo} - ${c.nombre_cargo}"?`)) return;
    try {
      await deleteCargo(c.codigo_cargo);
      toast.success('Cargo eliminado');
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar el cargo'));
    }
  };

  const paginas = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <TopBar title="Cargos" />
      <div className="p-4">
        <PageHeader title="Cargos"
          subtitle={`${total} cargo${total === 1 ? '' : 's'} registrado${total === 1 ? '' : 's'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo cargo
          </button>
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input className="form-control border-start-0"
                placeholder="Buscar por código o nombre..."
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
              <EmptyState icon="bi-briefcase"
                title={busqueda ? 'Sin resultados' : 'Sin cargos'}
                subtitle={busqueda
                  ? `No hay cargos que coincidan con "${busqueda}"`
                  : 'Crea el primer cargo con el botón de arriba'}
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
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(c => (
                    <tr key={c.codigo_cargo}>
                      <td>
                        <span className="badge bg-dark fs-6 fw-normal font-monospace">
                          {c.codigo_cargo}
                        </span>
                      </td>
                      <td className="fw-semibold">{c.nombre_cargo}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary"
                            onClick={() => abrirEditar(c)} title="Editar" disabled={!canEdit}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger"
                            onClick={() => eliminar(c)} title="Eliminar" disabled={!canDel}>
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
                  <i className="bi bi-briefcase me-2"></i>
                  {editando ? 'Editar cargo' : 'Nuevo cargo'}
                </h5>
                <button className="btn-close btn-close-white"
                  onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-4">
                      <label className="form-label small fw-semibold">
                        Código <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <input className="form-control font-monospace text-uppercase"
                          maxLength={2} value={form.codigo_cargo} required
                          placeholder="Ej: 01"
                          disabled={!!editando}
                          onChange={e => setForm({ ...form, codigo_cargo: e.target.value })} />
                        {!editando && (
                          <button type="button" className="btn btn-outline-success"
                            onClick={generarCodigo} title="Generar siguiente código">
                            <i className="bi bi-magic"></i>
                          </button>
                        )}
                      </div>
                      <div className="form-text">2 caracteres, único</div>
                    </div>
                    <div className="col-8">
                      <label className="form-label small fw-semibold">
                        Nombre <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" maxLength={20} value={form.nombre_cargo} required
                        placeholder="Nombre del cargo"
                        onChange={e => setForm({ ...form, nombre_cargo: e.target.value })} />
                      <div className="form-text">Máximo 20 caracteres</div>
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
