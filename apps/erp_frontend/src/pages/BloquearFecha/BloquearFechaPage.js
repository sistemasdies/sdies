import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import API from '../../api/client';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/formato';

const getUsuarios   = () => API.get('/users/');
const bloquearFecha = (user_ids, fecha) =>
  API.post('/users/bloquear-fecha/', { user_ids, fecha });

const MENSAJE = "El usuario no podrá modificar, ni eliminar ningún movimiento contable " +
  "'MoviCont' que sea igual o anterior a esa fecha; tampoco podrá adicionar ningún " +
  "movimiento nuevo que tenga fecha igual o anterior a la fecha seleccionada.";

export default function BloquearFechaPage() {
  const [usuarios,  setUsuarios]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [seleccion, setSeleccion] = useState([]);
  const [fecha,     setFecha]     = useState('');
  const [saving,    setSaving]    = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    getUsuarios()
      .then(r => setUsuarios(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggle = (id) =>
    setSeleccion(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const toggleTodos = () =>
    setSeleccion(s => s.length === usuarios.length
      ? []
      : usuarios.map(u => u.id));

  const aplicar = async (tipo) => {
    if (!seleccion.length) { toast.error('Seleccione al menos un usuario.'); return; }
    if (tipo === 'bloquear' && !fecha) { toast.error('Seleccione la fecha a bloquear.'); return; }
    setSaving(true);
    try {
      const res = await bloquearFecha(seleccion, tipo === 'bloquear' ? fecha : null);
      toast.success(res.data.detail);
      setFecha('');
      setSeleccion([]);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar la fecha de cierre.');
    } finally { setSaving(false); }
  };

  return (
    <MainLayout>
      <TopBar title="Bloquear Fecha" />
      <div className="p-4">
        <PageHeader title="Bloquear Fecha" subtitle="Procesos — fecha de cierre por usuario">
          <span className="badge bg-success"><i className="bi bi-calendar-x me-1"></i>Fechas de cierre</span>
        </PageHeader>

        <div className="alert alert-info d-flex align-items-start gap-2">
          <i className="bi bi-info-circle-fill mt-1"></i>
          <div>{MENSAJE}</div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Fecha a bloquear</label>
                <input type="date" className="form-control" value={fecha}
                       onChange={e => setFecha(e.target.value)} />
              </div>
              <div className="col-md-8 d-flex gap-2">
                <button className="btn btn-danger"
                        disabled={saving || !seleccion.length}
                        onClick={() => aplicar('bloquear')}>
                  <i className="bi bi-lock me-1"></i>Bloquear fecha a los usuarios seleccionados
                </button>
                <button className="btn btn-outline-secondary"
                        disabled={saving || !seleccion.length}
                        onClick={() => aplicar('desbloquear')}>
                  <i className="bi bi-unlock me-1"></i>Desbloquear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <div>
              <strong>Usuarios</strong>
              <span className="text-muted ms-2 small">
                {seleccion.length ? `${seleccion.length} seleccionado(s)` : `${usuarios.length} usuarios`}
              </span>
            </div>
            <button className="btn btn-sm btn-link" onClick={toggleTodos}>
              {seleccion.length === usuarios.length && usuarios.length ? 'Quitar todos' : 'Seleccionar todos'}
            </button>
          </div>
          <div className="table-responsive" style={{ maxHeight: 460, overflow: 'auto' }}>
            {loading ? (
              <div className="p-4 text-center"><Spinner /></div>
            ) : (
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Fecha de cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id}
                        className={!u.is_active ? 'text-muted' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggle(u.id)}>
                      <td>
                        <input type="checkbox" className="form-check-input"
                               checked={seleccion.includes(u.id)}
                               onChange={() => toggle(u.id)} />
                      </td>
                      <td>
                        <span className="fw-semibold">{u.login}</span>
                        <span className="ms-2 text-muted small">{u.NameUser}</span>
                        {!u.is_active && <span className="badge bg-secondary ms-2">Inactivo</span>}
                      </td>
                      <td className="small">{u.email}</td>
                      <td>
                        {u.fecha_cierre
                          ? <span className="badge bg-danger"><i className="bi bi-lock-fill me-1"></i>{formatDate(u.fecha_cierre)}</span>
                          : <span className="badge bg-success">Sin bloquear</span>}
                      </td>
                    </tr>
                  ))}
                  {!usuarios.length && !loading && (
                    <tr><td colSpan={4} className="text-center text-muted py-3">No hay usuarios.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}