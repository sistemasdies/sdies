import { useEffect, useState, useCallback, useRef } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import SelectorCongregacion from '../../components/common/SelectorCongregacion';
import { usePerm } from '../../hooks/usePerm';
import {
  getAcontecimientos, createAcontecimiento, updateAcontecimiento, deleteAcontecimiento,
  subirFotosAcontecimiento, eliminarFotoAcontecimiento,
} from '../../api/actividades';
import { getCongregaciones } from '../../api/congregaciones';
import { formatDate } from '../../utils/formato';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;
const FORM_VACIO = {
  id: '', fecha: '', congregacion: '', titulo: '', comentarios: '',
};

export default function AcontecimientosPage() {
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

  const [galeria, setGaleria] = useState({ open: false, acontecimiento: null, subiendo: false });
  const fileRef = useRef(null);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda.trim()) params.search = busqueda.trim();
    getAcontecimientos(params)
      .then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar los acontecimientos'))
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
      titulo: a.titulo || '',
      comentarios: a.comentarios || '',
    });
    setModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.fecha || !form.congregacion || !form.titulo.trim()) {
      toast.error('La fecha, congregación y título son obligatorios');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        fecha: form.fecha,
        congregacion: form.congregacion,
        titulo: form.titulo.trim(),
        comentarios: form.comentarios,
      };
      if (editando) {
        await updateAcontecimiento(editando.id, payload);
        toast.success('Acontecimiento actualizado');
      } else {
        await createAcontecimiento(payload);
        toast.success('Acontecimiento creado');
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
    if (!window.confirm(`¿Eliminar el acontecimiento "${a.titulo}"? Se borrarán también sus fotos.`)) return;
    try {
      await deleteAcontecimiento(a.id);
      toast.success('Acontecimiento eliminado');
      cargar();
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const abrirGaleria = (a) => setGaleria({ open: true, acontecimiento: a, subiendo: false });

  const onDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    await subirFiles(files);
  };

  const onFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await subirFiles(files);
    e.target.value = '';
  };

  const subirFiles = async (files) => {
    const a = galeria.acontecimiento;
    if (!a) return;
    const actuales = a.cantidad_fotos || a.fotos?.length || 0;
    if (actuales + files.length > 10) {
      toast.error(`Solo se permiten 10 fotos. Actualmente tiene ${actuales}.`);
      return;
    }
    setGaleria(g => ({ ...g, subiendo: true }));
    try {
      const r = await subirFotosAcontecimiento(a.id, files);
      if (r.data.errores?.length) {
        r.data.errores.forEach(err => toast.error(err));
      }
      if (r.data.creadas?.length) {
        toast.success(`${r.data.creadas.length} foto(s) subida(s)`);
        const nuevas = r.data.creadas;
        const fotosActuales = a.fotos || [];
        setGaleria(g => ({
          ...g,
          acontecimiento: {
            ...a,
            fotos: [...fotosActuales, ...nuevas].sort((x, y) => x.orden - y.orden),
            cantidad_fotos: fotosActuales.length + nuevas.length,
          },
        }));
      }
      cargar();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.join(' ') : (detail || 'Error al subir fotos'));
    } finally {
      setGaleria(g => ({ ...g, subiendo: false }));
    }
  };

  const eliminarFoto = async (foto) => {
    if (!window.confirm('¿Eliminar esta foto?')) return;
    const a = galeria.acontecimiento;
    try {
      await eliminarFotoAcontecimiento(a.id, foto.id);
      toast.success('Foto eliminada');
      const fotosRestantes = (a.fotos || []).filter(f => f.id !== foto.id);
      setGaleria(g => ({
        ...g,
        acontecimiento: {
          ...a,
          fotos: fotosRestantes,
          cantidad_fotos: fotosRestantes.length,
        },
      }));
      cargar();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.join(' ') : (detail || 'No se pudo eliminar la foto'));
    }
  };

  const totalPaginas = Math.ceil(total / PAGE_SIZE);
  const nombreCongregacion = (cod) => congregaciones.find(c => c.codigo === cod)?.nombre || cod;

  return (
    <MainLayout>
      <TopBar title="Acontecimientos" />
      <div className="p-4">
        <PageHeader title="Acontecimientos" subtitle="Registro fotográfico de eventos y salidas">
          {canAdd && (
            <button className="btn btn-success btn-sm" onClick={abrirNuevo}>
              <i className="bi bi-plus-lg me-2"></i>Nuevo acontecimiento
            </button>
          )}
        </PageHeader>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input className="form-control form-control-sm" placeholder="Buscar por título, comentario o congregación..."
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
            <EmptyState icon="bi-camera" title="Sin registros" subtitle="No hay acontecimientos registrados" />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>Item</th>
                      <th>Fecha</th>
                      <th>Congregación</th>
                      <th>Título</th>
                      <th>Comentarios</th>
                      <th className="text-center">Fotos</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(a => (
                      <tr key={a.id}>
                        <td><span className="badge bg-dark font-monospace">{a.item}</span></td>
                        <td>{formatDate(a.fecha)}</td>
                        <td><code className="me-1">{a.congregacion}</code>{a.congregacion_nombre}</td>
                        <td className="fw-semibold">{a.titulo}</td>
                        <td className="small text-muted">{a.comentarios || '—'}</td>
                        <td className="text-center">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => abrirGaleria(a)}>
                            <i className="bi bi-images me-1"></i>{a.cantidad_fotos}/10
                          </button>
                        </td>
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

      {/* Modal Acontecimiento */}
      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className={`bi ${editando ? 'bi-pencil' : 'bi-plus-lg'} me-2`}></i>
                  {editando ? 'Editar acontecimiento' : 'Nuevo acontecimiento'}
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
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Título <span className="text-danger">*</span></label>
                      <input type="text" maxLength={30} className="form-control" required
                        value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Comentarios</label>
                      <textarea className="form-control" rows={4}
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

      {/* Modal Galería */}
      {galeria.open && galeria.acontecimiento && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.7)', zIndex: 1070 }}
          onClick={e => { if (e.target === e.currentTarget) setGaleria({ open: false, acontecimiento: null, subiendo: false }); }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title">
                  <i className="bi bi-images me-2"></i>
                  {galeria.acontecimiento.titulo}
                  <small className="ms-2 text-white-50">
                    ({galeria.acontecimiento.cantidad_fotos || galeria.acontecimiento.fotos?.length || 0}/10)
                  </small>
                </h5>
                <button type="button" className="btn-close btn-close-white"
                  onClick={() => setGaleria({ open: false, acontecimiento: null, subiendo: false })}></button>
              </div>
              <div className="modal-body">
                {(galeria.acontecimiento.cantidad_fotos || galeria.acontecimiento.fotos?.length || 0) < 10 && (
                  <div
                    className="border border-success border-2 border-dashed rounded p-4 text-center mb-3"
                    style={{ cursor: 'pointer', background: '#f8fff8' }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                  >
                    <i className="bi bi-cloud-arrow-up fs-1 text-success"></i>
                    <div className="fw-semibold text-success">Arrastra fotos aquí o haz clic para seleccionar</div>
                    <div className="small text-muted">Máximo 10 fotos. JPG, PNG, WebP.</div>
                    <input type="file" multiple accept="image/*" className="d-none" ref={fileRef} onChange={onFileChange} />
                  </div>
                )}

                {galeria.subiendo && (
                  <div className="text-center py-3">
                    <span className="spinner-border spinner-border-sm me-2"></span>Subiendo fotos...
                  </div>
                )}

                {(!galeria.acontecimiento.fotos || galeria.acontecimiento.fotos.length === 0) ? (
                  <div className="text-center text-muted py-4">
                    <i className="bi bi-image display-6 d-block mb-2"></i>
                    No hay fotos registradas
                  </div>
                ) : (
                  <div className="row g-2">
                    {galeria.acontecimiento.fotos.map(f => (
                      <div key={f.id} className="col-6 col-md-4 col-lg-3">
                        <div className="card h-100">
                          <img
                            src={f.url.replace('/upload/', '/upload/w_400,q_auto,f_auto/')}
                            className="card-img-top"
                            alt={f.descripcion || 'Foto'}
                            style={{ height: 160, objectFit: 'cover' }}
                          />
                          <div className="card-body p-2">
                            <div className="d-flex justify-content-between align-items-center">
                              <small className="text-muted font-monospace">#{f.orden}</small>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => eliminarFoto(f)}>
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setGaleria({ open: false, acontecimiento: null, subiendo: false })}>
                  Cerrar
                </button>
              </div>
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
