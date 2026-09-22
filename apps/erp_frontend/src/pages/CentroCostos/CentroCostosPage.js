import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { getCentrosCosto, createCentroCosto, updateCentroCosto, deleteCentroCosto } from '../../api/centrosCosto';
import { getTerceros } from '../../api/terceros';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const FORM_VACIO = { codigo: '', descripcion: '', responsable: '', is_active: true };

export default function CentroCostosPage() {
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);
  const [centros,   setCentros]   = useState([]);
  const [terceros,  setTerceros]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [busqueda,  setBusqueda]  = useState('');
  const [busqResp,  setBusqResp]  = useState('');
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(FORM_VACIO);
  const [editando,  setEditando]  = useState(null);
  const [saving,    setSaving]    = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.allSettled([getCentrosCosto(), getTerceros({ page_size: 300 })])
      .then(([cc, t]) => {
        if (cc.status === 'fulfilled') setCentros(cc.value.data.results || cc.value.data);
        if (t.status === 'fulfilled') setTerceros(t.value.data.results || t.value.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setModal(true); };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({
      codigo: c.codigo, descripcion: c.descripcion,
      responsable: c.responsable || '', is_active: c.is_active,
    });
    setModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, responsable: form.responsable || null };
      if (editando) {
        await updateCentroCosto(editando.id, payload);
        toast.success('Centro de costo actualizado');
      } else {
        await createCentroCosto(payload);
        toast.success('Centro de costo creado');
      }
      setModal(false);
      cargar();
    } catch (err) {
      const msg = err.response?.data?.codigo?.[0]
               || err.response?.data?.detail
               || 'Error al guardar';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar el centro de costo "${c.codigo} - ${c.descripcion}"?`)) return;
    try {
      await deleteCentroCosto(c.id);
      toast.success('Centro de costo eliminado');
      cargar();
    } catch {
      toast.error('No se puede eliminar — tiene movimientos asociados');
    }
  };

  const filtrados = centros.filter(c =>
    c.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.descripcion.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <MainLayout>
      <TopBar title="Centros de Costo" />
      <div className="p-4">
        <PageHeader title="Centros de Costo"
          subtitle={`${centros.length} centros registrados`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo centro
          </button>
        </PageHeader>

        {/* Buscador */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 380 }}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input className="form-control border-start-0"
                placeholder="Buscar por código o descripción..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)} />
              {busqueda && (
                <button className="btn btn-outline-secondary"
                  onClick={() => setBusqueda('')}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          {loading ? (
            <div className="card-body"><Spinner /></div>
          ) : filtrados.length === 0 ? (
            <div className="card-body">
              <EmptyState icon="bi-bullseye"
                title="Sin centros de costo"
                subtitle="Crea el primer centro de costo con el botón de arriba"
                action={
                  <button className="btn btn-success mt-2" onClick={abrirNuevo} disabled={!canAdd}>
                    <i className="bi bi-plus-lg me-1"></i>Crear ahora
                  </button>
                } />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Responsable</th>
                    <th className="text-center">Estado</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(c => (
                    <tr key={c.id}>
                      <td>
                        <span className="badge bg-dark fs-6 fw-normal font-monospace">
                          {c.codigo}
                        </span>
                      </td>
                      <td className="fw-semibold">{c.descripcion}</td>
                      <td className="small text-muted">
                        {c.responsable_nombre || (
                          <span className="fst-italic">Sin responsable</span>
                        )}
                      </td>
                      <td className="text-center">
                        {c.is_active
                          ? <span className="badge bg-success">Activo</span>
                          : <span className="badge bg-secondary">Inactivo</span>}
                      </td>
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
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-bullseye me-2"></i>
                  {editando ? 'Editar centro de costo' : 'Nuevo centro de costo'}
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
                      <input className="form-control font-monospace text-uppercase"
                        maxLength={7} value={form.codigo} required
                        disabled={!!editando}
                        placeholder="Ej: CC001"
                        onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} />
                      <div className="form-text">Máximo 7 caracteres</div>
                    </div>
                    <div className="col-8">
                      <label className="form-label small fw-semibold">
                        Descripción <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" value={form.descripcion} required
                        placeholder="Nombre del centro de costo"
                        onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Responsable</label>
                      <input className="form-control form-control-sm"
                        placeholder="Buscar por cédula o nombre..."
                        value={busqResp}
                        onChange={e => setBusqResp(e.target.value)} />
                      <div className="border rounded mt-1" style={{maxHeight:160,overflowY:'auto'}}>
                        <div className="list-group list-group-flush list-group-flush-sm">
                          <button type="button"
                            className={`list-group-item list-group-item-action py-1 small ${form.responsable===''?'active':''}`}
                            onClick={() => { setForm({...form, responsable:''}); setBusqResp(''); }}>
                            — Sin responsable —
                          </button>
                          {terceros
                            .filter(t => {
                              if (!busqResp) return true;
                              const q = busqResp.toLowerCase();
                              return t.cedula?.toLowerCase().includes(q) ||
                                     t.nombre_completo?.toLowerCase().includes(q);
                            })
                            .sort((a,b) => (a.nombre_completo||'').localeCompare(b.nombre_completo||''))
                            .map(t => (
                              <button key={t.id} type="button"
                                className={`list-group-item list-group-item-action py-1 small ${form.responsable===t.cedula?'active':''}`}
                                onClick={() => { setForm({...form, responsable:t.cedula}); setBusqResp(''); }}>
                                <code className="small me-1">{t.cedula}</code> {t.nombre_completo}
                              </button>
                            ))}
                        </div>
                      </div>
                      {form.responsable && (
                        <div className="form-text">
                          Seleccionado: <strong>{form.responsable}</strong>
                          <button type="button" className="btn btn-link btn-sm p-0 ms-2"
                            onClick={() => setForm({...form, responsable:''})}>
                            <i className="bi bi-x-circle"></i> Quitar
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input type="checkbox" className="form-check-input"
                          id="ccActivo" checked={form.is_active}
                          onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                        <label className="form-check-label small" htmlFor="ccActivo">
                          Centro de costo activo
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary"
                    onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={saving || (editando ? !canEdit : !canAdd)}>
                    {saving
                      ? <><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                      : <><i className="bi bi-check2 me-1"></i>Guardar</>
                    }
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
