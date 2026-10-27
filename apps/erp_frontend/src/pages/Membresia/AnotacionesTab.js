import { useEffect, useState, useCallback } from 'react';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import {
  getAnotacionesPastor, createAnotacionPastor,
  updateAnotacionPastor, deleteAnotacionPastor,
  getAnotacionesMisionero, createAnotacionMisionero,
  updateAnotacionMisionero, deleteAnotacionMisionero,
} from '../../api/anotaciones';
import toast from 'react-hot-toast';

const API_BY_TIPO = {
  pastor: {
    get: getAnotacionesPastor,
    create: createAnotacionPastor,
    update: updateAnotacionPastor,
    delete: deleteAnotacionPastor,
    label: 'pastor',
  },
  misionero: {
    get: getAnotacionesMisionero,
    create: createAnotacionMisionero,
    update: updateAnotacionMisionero,
    delete: deleteAnotacionMisionero,
    label: 'misionero',
  },
};

export default function AnotacionesTab({ cedula, tipo }) {
  const api = API_BY_TIPO[tipo];
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ fecha: '', anotacion: '', cedula_firma: '' });
  const [firmaNombre, setFirmaNombre] = useState('');
  const [editando, setEditando] = useState(null);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    if (!cedula) { setLista([]); return; }
    setLoading(true);
    api.get({ cedula, page_size: 100 })
      .then(r => setLista(r.data.results || r.data || []))
      .catch(() => toast.error('No se pudieron cargar las anotaciones'))
      .finally(() => setLoading(false));
  }, [cedula, api]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!cedula) {
    return (
      <div className="text-muted small fst-italic">
        Guarde la membresía (con cédula) para poder registrar anotaciones.
      </div>
    );
  }

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ fecha: '', anotacion: '', cedula_firma: cedula });
    setFirmaNombre('');
    setModal(true);
  };

  const abrirEditar = (a) => {
    setEditando(a);
    setForm({
      fecha: a.fecha || '',
      anotacion: a.anotacion || '',
      cedula_firma: a.cedula_firma || '',
    });
    setFirmaNombre(a.cedula_firma_nombre || '');
    setModal(true);
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const payload = {
        cedula,
        fecha: form.fecha,
        anotacion: form.anotacion.trim(),
        cedula_firma: form.cedula_firma || null,
      };
      if (editando) {
        await api.update(editando.id, payload);
        toast.success('Anotación actualizada');
      } else {
        await api.create(payload);
        toast.success('Anotación creada');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar la anotación');
    } finally { setSaving(false); }
  };

  const eliminar = async (a) => {
    if (!window.confirm('¿Eliminar esta anotación?')) return;
    try {
      await api.delete(a.id);
      toast.success('Anotación eliminada');
      cargar();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo eliminar');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-end mb-2">
        <button type="button" className="btn btn-sm btn-success" onClick={abrirNuevo}>
          <i className="bi bi-plus-lg me-1"></i>Nueva anotación
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : lista.length === 0 ? (
        <EmptyState icon="bi-chat-left-text"
          title="Sin anotaciones"
          subtitle="No hay anotaciones registradas para este miembro" />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-dark">
              <tr>
                <th>Fecha</th>
                <th>Anotación</th>
                <th>Firma</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(a => (
                <tr key={a.id}>
                  <td className="small">{a.fecha}</td>
                  <td className="small">{a.anotacion}</td>
                  <td className="small text-muted">{a.cedula_firma_nombre || a.cedula_firma}</td>
                  <td className="text-center">
                    <div className="btn-group btn-group-sm">
                      <button type="button" className="btn btn-outline-primary" onClick={() => abrirEditar(a)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button type="button" className="btn btn-outline-danger" onClick={() => eliminar(a)}>
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

      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  {editando ? 'Editar anotación' : 'Nueva anotación'}
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Fecha <span className="text-danger">*</span></label>
                    <input type="date" className="form-control" value={form.fecha} required
                      onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Anotación <span className="text-danger">*</span></label>
                    <textarea className="form-control" rows={4} value={form.anotacion} required
                      onChange={e => setForm(f => ({ ...f, anotacion: e.target.value }))} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Cédula firma</label>
                    <input className="form-control" value={form.cedula_firma}
                      placeholder="Cédula de quien firma"
                      onChange={e => setForm(f => ({ ...f, cedula_firma: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="button" className="btn btn-success" onClick={guardar} disabled={saving}>
                    {saving ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
