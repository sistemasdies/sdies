import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import SelectorCongregacion from '../../components/common/SelectorCongregacion';
import { usePerm } from '../../hooks/usePerm';
import { getAsistencias, createAsistencia, updateAsistencia, deleteAsistencia } from '../../api/actividades';
import { getCongregaciones } from '../../api/congregaciones';
import { formatDate } from '../../utils/formato';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;
const FORM_VACIO = {
  id: '', fecha: '', congregacion: '', creyentes: 0, simpatizantes: 0,
  visitas: 0, ninos: 0, comentarios: '',
};

export default function AsistenciaPage() {
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

  const [congregaciones, setCongregaciones] = useState([]);
  const [selectorCong, setSelectorCong] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda.trim()) params.search = busqueda.trim();
    getAsistencias(params)
      .then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar las asistencias'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);

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

  const abrirEditar = (a) => {
    setEditando(a);
    setForm({
      id: a.id,
      fecha: a.fecha || '',
      congregacion: a.congregacion || '',
      creyentes: a.creyentes || 0,
      simpatizantes: a.simpatizantes || 0,
      visitas: a.visitas || 0,
      ninos: a.ninos || 0,
      comentarios: a.comentarios || '',
    });
    setModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.fecha || !form.congregacion) {
      toast.error('La fecha y la congregación son obligatorias');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        fecha: form.fecha,
        congregacion: form.congregacion,
        creyentes: parseInt(form.creyentes, 10) || 0,
        simpatizantes: parseInt(form.simpatizantes, 10) || 0,
        visitas: parseInt(form.visitas, 10) || 0,
        ninos: parseInt(form.ninos, 10) || 0,
        comentarios: form.comentarios,
      };
      if (editando) {
        await updateAsistencia(editando.id, payload);
        toast.success('Asistencia actualizada');
      } else {
        await createAsistencia(payload);
        toast.success('Asistencia creada');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (a) => {
    if (!window.confirm(`¿Eliminar el registro de asistencia del ${formatDate(a.fecha)}?`)) return;
    try {
      await deleteAsistencia(a.id);
      toast.success('Asistencia eliminada');
      cargar();
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const totalPaginas = Math.ceil(total / PAGE_SIZE);
  const nombreCongregacion = (cod) => congregaciones.find(c => c.codigo === cod)?.nombre || cod;

  return (
    <MainLayout>
      <TopBar title="Asistencia" />
      <div className="p-4">
        <PageHeader title="Asistencia" subtitle="Registro de asistencia por congregación">
          {canAdd && (
            <button className="btn btn-success btn-sm" onClick={abrirNuevo}>
              <i className="bi bi-plus-lg me-2"></i>Nueva asistencia
            </button>
          )}
        </PageHeader>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input className="form-control form-control-sm" placeholder="Buscar..."
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
            <EmptyState icon="bi-people" title="Sin registros" subtitle="No hay asistencias registradas" />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>Fecha</th>
                      <th>Congregación</th>
                      <th className="text-end">Creyentes</th>
                      <th className="text-end">Simpatizantes</th>
                      <th className="text-end">Visitas</th>
                      <th className="text-end">Niños</th>
                      <th className="text-end">Total</th>
                      <th>Comentarios</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(a => (
                      <tr key={a.id}>
                        <td>{formatDate(a.fecha)}</td>
                        <td><code className="me-1">{a.congregacion}</code>{a.congregacion_nombre}</td>
                        <td className="text-end">{a.creyentes}</td>
                        <td className="text-end">{a.simpatizantes}</td>
                        <td className="text-end">{a.visitas}</td>
                        <td className="text-end">{a.ninos}</td>
                        <td className="text-end fw-bold">{a.total}</td>
                        <td className="small text-muted">{a.comentarios || '—'}</td>
                        <td className="text-center">
                          {canEdit && (
                            <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrirEditar(a)}>
                              <i className="bi bi-pencil"></i>
                            </button>
                          )}
                          {canDel && (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => eliminar(a)}>
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
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className={`bi ${editando ? 'bi-pencil' : 'bi-plus-lg'} me-2`}></i>
                  {editando ? 'Editar asistencia' : 'Nueva asistencia'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Fecha <span className="text-danger">*</span></label>
                      <input type="date" className="form-control" required
                        value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Congregación <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input className="form-control font-monospace" required readOnly
                          value={form.congregacion} placeholder="Código" />
                        <button type="button" className="btn btn-outline-success" onClick={() => setSelectorCong(true)}>
                          <i className="bi bi-search"></i>
                        </button>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold">Creyentes</label>
                      <input type="number" min="0" className="form-control"
                        value={form.creyentes} onChange={e => setForm(f => ({ ...f, creyentes: e.target.value }))} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold">Simpatizantes</label>
                      <input type="number" min="0" className="form-control"
                        value={form.simpatizantes} onChange={e => setForm(f => ({ ...f, simpatizantes: e.target.value }))} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold">Visitas</label>
                      <input type="number" min="0" className="form-control"
                        value={form.visitas} onChange={e => setForm(f => ({ ...f, visitas: e.target.value }))} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold">Niños</label>
                      <input type="number" min="0" className="form-control"
                        value={form.ninos} onChange={e => setForm(f => ({ ...f, ninos: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Comentarios</label>
                      <input type="text" maxLength={200} className="form-control"
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
    </MainLayout>
  );
}
