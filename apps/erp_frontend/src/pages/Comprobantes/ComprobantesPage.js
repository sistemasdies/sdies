import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { getComprobantes, createComprobante, updateComprobante } from '../../api/comprobantes';
import API from '../../api/client';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const eliminarComprobante    = (id) => API.delete(`/comprobantes/${id}/`);
const eliminarDefinitivo     = (id) => API.delete(`/comprobantes/${id}/eliminar-definitivo/`);
const getEliminados          = ()   => API.get('/comprobantes/lista-eliminados/');
const restaurarComprobante   = (id) => API.post(`/comprobantes/${id}/restaurar/`);

const FORM_VACIO = { codigo:'', descripcion:'', numero_inicial:1, activo:true };

export default function ComprobantesPage() {
  const [comprobantes, setComprobantes] = useState([]);
  const [eliminados,   setEliminados]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [modalDel,     setModalDel]     = useState(null);
  const [showEliminados, setShowEliminados] = useState(false);
  const [modalDelDef,    setModalDelDef]    = useState(null); // eliminación definitiva
  const [form,         setForm]         = useState(FORM_VACIO);
  const [editando,     setEditando]     = useState(null);
  const [saving,       setSaving]       = useState(false);

  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      getComprobantes(),
      getEliminados(),
    ]).then(([activos, elim]) => {
      if (activos.status === 'fulfilled') setComprobantes(activos.value.data.results || activos.value.data);
      if (elim.status === 'fulfilled') setEliminados(elim.value.data.results || elim.value.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setModal(true); };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({ codigo: c.codigo, descripcion: c.descripcion,
              numero_inicial: c.numero_inicial ?? 1, activo: c.activo });
    setModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, codigo: form.codigo.trim(),
                        numero_inicial: parseInt(form.numero_inicial) || 1 };
      if (editando) {
        await updateComprobante(editando.id, payload);
        toast.success('Comprobante actualizado');
      } else {
        await createComprobante(payload);
        toast.success('Comprobante creado');
      }
      setModal(false); cargar();
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.codigo?.[0] || d?.detail || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const confirmarEliminar = async () => {
    try {
      await eliminarComprobante(modalDel.id);
      toast.success('Comprobante eliminado');
      cargar();
    } catch { toast.error('No se puede eliminar — tiene asientos asociados'); }
    setModalDel(null);
  };

  const confirmarEliminarDef = async () => {
    try {
      await eliminarDefinitivo(modalDelDef.id);
      toast.success(`Comprobante ${modalDelDef.codigo} eliminado definitivamente`);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se puede eliminar — tiene asientos asociados');
    }
    setModalDelDef(null);
  };

  const restaurar = async (c) => {
    try {
      await restaurarComprobante(c.id);
      toast.success(`Comprobante ${c.codigo} restaurado`);
      cargar();
    } catch { toast.error('Error al restaurar'); }
  };

  return (
    <MainLayout>
      <TopBar title="Comprobantes" />
      <div className="p-4">
        <PageHeader title="Comprobantes Contables"
          subtitle={`${comprobantes.length} activo(s)${eliminados.length ? ` · ${eliminados.length} eliminado(s)` : ''}`}>
          {eliminados.length > 0 && (
            <button className={`btn btn-sm ${showEliminados?'btn-warning':'btn-outline-warning'}`}
              onClick={() => setShowEliminados(p => !p)}>
              <i className="bi bi-trash me-1"></i>
              {showEliminados ? 'Ocultar eliminados' : `Ver eliminados (${eliminados.length})`}
            </button>
          )}
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo
          </button>
        </PageHeader>

        {/* Comprobantes eliminados (restaurables) */}
        {showEliminados && eliminados.length > 0 && (
          <div className="card border-warning shadow-sm mb-3">
            <div className="card-header bg-warning text-dark fw-semibold">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Comprobantes eliminados — puedes restaurarlos
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Código</th><th>Descripción</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {eliminados.map(c => (
                    <tr key={c.id} className="table-warning">
                      <td><code className="fw-bold">{c.codigo}</code></td>
                      <td>{c.descripcion}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-success btn-sm"
                            onClick={() => restaurar(c)}>
                            <i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar
                          </button>
                          <button className="btn btn-danger btn-sm"
                            onClick={() => setModalDelDef(c)}
                            disabled={!canDel}
                            title="Eliminar definitivamente de la BD">
                            <i className="bi bi-trash-fill me-1"></i>Eliminar definitivo
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Comprobantes activos */}
        <div className="card border-0 shadow-sm">
          {loading ? <div className="card-body"><Spinner /></div>
          : comprobantes.length === 0 ? (
            <div className="card-body">
              <EmptyState icon="bi-receipt" title="Sin comprobantes"
                subtitle="Crea el primer tipo de comprobante"
                action={<button className="btn btn-success mt-2" onClick={abrirNuevo} disabled={!canAdd}>
                  <i className="bi bi-plus-lg me-1"></i>Crear</button>}/>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark">
                  <tr>
                    <th style={{width:100}}>Código</th>
                    <th>Descripción</th>
                    <th className="text-center" style={{width:120}}>Nº inicial</th>
                    <th className="text-center" style={{width:100}}>Activo</th>
                    <th className="text-center" style={{width:130}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {comprobantes.map(c => (
                    <tr key={c.id}>
                      <td><code className="fw-bold fs-6">{c.codigo}</code></td>
                      <td className="fw-semibold">{c.descripcion}</td>
                      <td className="text-center">
                        <span className="badge bg-secondary">{c.numero_inicial ?? 1}</span>
                      </td>
                      <td className="text-center">
                        {c.activo
                          ? <span className="badge bg-success">Activo</span>
                          : <span className="badge bg-danger">Inactivo</span>}
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary"
                            onClick={() => abrirEditar(c)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger"
                            disabled={!canDel}
                            onClick={() => setModalDel(c)}
                            title="Eliminar (soft)">
                            <i className="bi bi-trash"></i>
                          </button>
                          <button className="btn btn-danger"
                            disabled={!canDel}
                            onClick={() => setModalDelDef(c)}
                            title="Eliminar definitivamente">
                            <i className="bi bi-trash-fill"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:440}}>
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-receipt me-2"></i>
                  {editando ? 'Editar comprobante' : 'Nuevo comprobante'}
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-4">
                      <label className="form-label small fw-semibold">
                        Código <span className="text-danger">*</span>
                      </label>
                      <input className="form-control font-monospace"
                        maxLength={7} value={form.codigo} required
                        disabled={!!editando} placeholder="Ej: CC, CE..."
                        onChange={e => setForm({...form, codigo: e.target.value})}/>
                      <div className="form-text">Máx. 7 caracteres</div>
                    </div>
                    <div className="col-8">
                      <label className="form-label small fw-semibold">
                        Descripción <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" value={form.descripcion} required
                        placeholder="Nombre del comprobante"
                        onChange={e => setForm({...form, descripcion: e.target.value})}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Número inicial</label>
                      <input type="number" className="form-control" min={1}
                        value={form.numero_inicial}
                        onChange={e => setForm({...form, numero_inicial: e.target.value})}/>
                    </div>
                    <div className="col-6 d-flex align-items-center pt-3">
                      <div className="form-check form-switch ms-2 mt-2">
                        <input type="checkbox" className="form-check-input"
                          id="activoCheck" checked={form.activo}
                          onChange={e => setForm({...form, activo: e.target.checked})}/>
                        <label className="form-check-label fw-semibold" htmlFor="activoCheck">
                          {form.activo ? 'Activo' : 'Inactivo'}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary"
                    onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={!canAdd || saving}>
                    {saving
                      ?<><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                      :<><i className="bi bi-check2 me-1"></i>Guardar</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {modalDel && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:420}}>
            <div className="modal-content shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>Eliminar comprobante
                </h5>
                <button className="btn-close" onClick={() => setModalDel(null)}></button>
              </div>
              <div className="modal-body pt-2">
                <p className="mb-2">¿Eliminar el comprobante:</p>
                <div className="bg-light rounded p-3">
                  <code className="fw-bold">{modalDel.codigo}</code> — {modalDel.descripcion}
                </div>
                <p className="text-muted small mt-2 mb-0">
                  Podrás restaurarlo desde la opción "Ver eliminados".
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-secondary" onClick={() => setModalDel(null)}>
                  Cancelar</button>
                <button className="btn btn-danger" onClick={confirmarEliminar} disabled={!canDel}>
                  <i className="bi bi-trash me-1"></i>Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal eliminar definitivamente */}
      {modalDelDef && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.7)'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:440}}>
            <div className="modal-content shadow border-danger">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-octagon me-2"></i>
                  Eliminar definitivamente
                </h5>
                <button className="btn-close btn-close-white"
                  onClick={() => setModalDelDef(null)}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-danger border-0 mb-3">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  <strong>Esta acción es irreversible.</strong> El registro será eliminado
                  físicamente de la base de datos y no podrá recuperarse.
                </div>
                <p className="mb-2">¿Eliminar definitivamente:</p>
                <div className="bg-light rounded p-3">
                  <code className="fw-bold">{modalDelDef.codigo}</code> — {modalDelDef.descripcion}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary"
                  onClick={() => setModalDelDef(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={confirmarEliminarDef} disabled={!canDel}>
                  <i className="bi bi-trash-fill me-1"></i>Sí, eliminar definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}