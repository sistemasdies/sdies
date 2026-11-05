import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import { getActas, deleteActa, cambiarEstadoActa } from '../../api/actas';
import { getCongregaciones } from '../../api/congregaciones';
import API from '../../api/client';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const ESTADOS = {
  '1': { label: 'Borrador', class: 'bg-secondary' },
  '2': { label: 'Revisada', class: 'bg-info text-dark' },
  '3': { label: 'Firmada', class: 'bg-success' },
  '4': { label: 'Archivada', class: 'bg-warning text-dark' },
};

export default function ActasPage() {
  const navigate = useNavigate();
  const { canAdd, canEdit, canDel } = usePerm('/actas');
  const [actas, setActas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [congregaciones, setCongregaciones] = useState([]);
  const [filtros, setFiltros] = useState({
    congregacion: '',
    estado: '',
    tipo: '',
    search: '',
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtros.congregacion) params.congregacion = filtros.congregacion;
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.tipo) params.tipo = filtros.tipo;
      if (filtros.search) params.search = filtros.search;
      const r = await getActas(params);
      setActas(r.data.results || r.data);
    } catch (err) {
      toast.error('Error al cargar actas');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargar();
    getCongregaciones({ page_size: 10000 })
      .then(r => setCongregaciones(r.data.results || r.data))
      .catch(() => {});
  }, [cargar]);

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta acta?')) return;
    try {
      await deleteActa(id);
      toast.success('Acta eliminada');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se puede eliminar');
    }
  };

  const handleCambiarEstado = async (id, estado) => {
    try {
      await cambiarEstadoActa(id, estado);
      toast.success('Estado actualizado');
      cargar();
    } catch (err) {
      toast.error('Error al cambiar estado');
    }
  };

  return (
    <MainLayout>
      <TopBar title="Actas de Reunión" />
      <div className="p-4">
        <PageHeader title="Actas de Reunión" subtitle={`${actas.length} acta(s)`}>
          <button className="btn btn-success" onClick={() => navigate('/secretaria/actas/nueva')} disabled={!canAdd}>
            <i className="bi bi-file-earmark-plus me-1"></i>Nueva acta
          </button>
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-2">
              <div className="col-md-3">
                <select className="form-select form-select-sm"
                  value={filtros.congregacion} onChange={e => setFiltros(f => ({ ...f, congregacion: e.target.value }))}>
                  <option value="">Todas las congregaciones</option>
                  {congregaciones.map(c => (
                    <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <select className="form-select form-select-sm"
                  value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}>
                  <option value="">Todos los estados</option>
                  {Object.entries(ESTADOS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <input className="form-control form-control-sm" placeholder="Buscar título o contenido..."
                  value={filtros.search} onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <button className="btn btn-sm btn-outline-secondary w-100" onClick={cargar}>
                  <i className="bi bi-search me-1"></i>Buscar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          {loading ? <div className="card-body"><Spinner /></div> : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Código</th>
                    <th>Título</th>
                    <th>Congregación</th>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Firmas</th>
                    <th>Autor</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {actas.length === 0
                    ? <tr><td colSpan={9} className="text-center text-muted py-4">Sin actas</td></tr>
                    : actas.map(a => (
                      <tr key={a.id}>
                        <td><span className="font-monospace fw-bold">{a.codigo}</span></td>
                        <td>{a.titulo}</td>
                        <td>{a.congregacion_nombre}</td>
                        <td>{a.fecha_reunion}</td>
                        <td>{a.tipo}</td>
                        <td>
                          <span className={`badge ${ESTADOS[a.estado]?.class || 'bg-secondary'}`}>
                            {ESTADOS[a.estado]?.label || a.estado}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            {a.firmas_completadas || 0}/{a.total_firmas || 0}
                          </span>
                        </td>
                        <td className="text-muted small">{a.autor_nombre}</td>
                        <td className="text-center">
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary" onClick={() => navigate(`/secretaria/actas/${a.id}`)} disabled={!canEdit}>
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button className="btn btn-outline-info" onClick={() => navigate(`/secretaria/actas/${a.id}/ver`)}>
                              <i className="bi bi-eye"></i>
                            </button>
                            <button className="btn btn-outline-danger" onClick={() => handleEliminar(a.id)} disabled={!canDel}>
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
    </MainLayout>
  );
}
