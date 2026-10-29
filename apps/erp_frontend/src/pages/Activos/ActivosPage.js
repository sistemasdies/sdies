import { useEffect, useState, useCallback, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import SelectorTercero from '../../components/common/SelectorTercero';
import SelectorCongregacion from '../../components/common/SelectorCongregacion';
import {
  getActivos, createActivo, updateActivo, deleteActivo,
  getCategorias, getUbicaciones, getEstadosActivo,
  getFotosActivo, subirFotoActivo, eliminarFotoActivoCloud,
} from '../../api/activos';
import { getCongregaciones } from '../../api/congregaciones';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const PAGE_SIZE = 50;
const FORM_VACIO = {
  id_activo_f: '', nombre_activo_f: '', categoria: '', marca: '', modelo: '',
  numero_serie: '', congregacion: '', ubicacion: '', responsable: '',
  estado_actual: '1', fecha_adquisicion: '', valor_compra: '', comentarios: '',
};

export default function ActivosPage() {
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

  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [estados, setEstados] = useState([]);
  const [congregaciones, setCongregaciones] = useState([]);
  const [selectorTercero, setSelectorTercero] = useState(false);
  const [selectorCong, setSelectorCong] = useState(false);
  const [respNombre, setRespNombre] = useState('');
  const [fotos, setFotos] = useState([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [cropSrc, setCropSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [showCrop, setShowCrop] = useState(false);
  const imgRef = useRef(null);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda.trim()) params.search = busqueda.trim();
    getActivos(params)
      .then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar los activos'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    getCategorias({ page_size: 1000 }).then(r => setCategorias(r.data.results || r.data || [])).catch(() => {});
    getUbicaciones({ page_size: 1000 }).then(r => setUbicaciones(r.data.results || r.data || [])).catch(() => {});
    getEstadosActivo({ page_size: 1000 }).then(r => setEstados(r.data.results || r.data || [])).catch(() => {});
    getCongregaciones({ page_size: 1000 }).then(r => setCongregaciones(r.data.results || r.data || [])).catch(() => {});
  }, []);

  const generarCodigo = async () => {
    try {
      const r = await getActivos({ page: 1, page_size: 1000 });
      const lista = r.data.results || r.data || [];
      let max = 9999;
      lista.forEach(a => {
        const n = parseInt(a.id_activo_f, 10);
        if (!isNaN(n) && n > max) max = n;
      });
      const next = String(max + 1).padStart(5, '0');
      setForm(f => ({ ...f, id_activo_f: next }));
    } catch {
      toast.error('No se pudo generar el código');
    }
  };
  const cargarFotos = (id) => {
    if (!id) { setFotos([]); return; }
    getFotosActivo({ activo: id, page_size: 100 })
      .then(r => setFotos(r.data.results || r.data || []))
      .catch(() => {});
  };
  const abrirNuevo = () => {
    setEditando(null); setForm(FORM_VACIO); setRespNombre(''); setFotos([]); setModal(true);
  };
  const abrirEditar = (a) => {
    setEditando(a);
    setForm({
      id_activo_f: a.id_activo_f || '',
      nombre_activo_f: a.nombre_activo_f || '',
      categoria: a.categoria || '',
      marca: a.marca || '',
      modelo: a.modelo || '',
      numero_serie: a.numero_serie || '',
      congregacion: a.congregacion || '',
      ubicacion: a.ubicacion || '',
      responsable: a.responsable || '',
      estado_actual: a.estado_actual || '1',
      fecha_adquisicion: a.fecha_adquisicion || '',
      valor_compra: a.valor_compra ?? '',
      comentarios: a.comentarios || '',
    });
    setRespNombre(a.responsable_nombre || '');
    setModal(true);
    cargarFotos(a.id_activo_f);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.fecha_adquisicion) payload.fecha_adquisicion = null;
      if (payload.valor_compra === '') payload.valor_compra = null;
      if (!payload.congregacion) payload.congregacion = null;
      if (!payload.responsable) payload.responsable = null;
      if (editando) { await updateActivo(editando.id_activo_f, payload); toast.success('Activo actualizado'); }
      else { await createActivo(payload); toast.success('Activo creado'); }
      setModal(false); cargar();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar el activo');
    } finally { setSaving(false); }
  };

  const eliminar = async (a) => {
    if (!window.confirm(`¿Eliminar el activo "${a.id_activo_f} - ${a.nombre_activo_f}"?`)) return;
    try { await deleteActivo(a.id_activo_f); toast.success('Activo eliminado'); cargar(); }
    catch (err) { toast.error(err?.response?.data?.detail || 'No se pudo eliminar el activo'); }
  };

  const elegirResponsable = (t) => {
    setForm(f => ({ ...f, responsable: t.cedula }));
    setRespNombre(t.nombre_completo);
    setSelectorTercero(false);
  };

  const subirFotoActivoUI = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editando) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Formato no permitido. Use JPG, PNG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera los 5 MB.');
      return;
    }
    setCropSrc(URL.createObjectURL(file));
    setCrop(undefined);
    setCompletedCrop(undefined);
    setShowCrop(true);
  };

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    const c = centerCrop(makeAspectCrop({ unit: 'px', width: Math.min(width, 320) }, 4 / 3, width, height), width, height);
    setCrop(c);
  };

  const aplicarRecorteActivo = async () => {
    if (!imgRef.current || !completedCrop) {
      toast.error('Seleccione un área de recorte.');
      return;
    }
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = Math.max(1, completedCrop.width * scaleX);
    canvas.height = Math.max(1, completedCrop.height * scaleY);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, completedCrop.x * scaleX, completedCrop.y * scaleY, completedCrop.width * scaleX, completedCrop.height * scaleY, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) { toast.error('No se pudo procesar la imagen.'); return; }
    const file = new File([blob], 'foto.jpg', { type: 'image/jpeg' });
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc('');
    setShowCrop(false);
    setSubiendoFoto(true);
    try {
      await subirFotoActivo(editando.id_activo_f, file);
      toast.success('Foto subida');
      cargarFotos(editando.id_activo_f);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const cancelarRecorteActivo = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc('');
    setShowCrop(false);
  };

  const quitarFotoActivo = async (foto) => {
    if (!editando) return;
    if (!window.confirm('¿Eliminar esta foto?')) return;
    try {
      await eliminarFotoActivoCloud(editando.id_activo_f, foto.id);
      toast.success('Foto eliminada');
      cargarFotos(editando.id_activo_f);
    } catch {
      toast.error('No se pudo eliminar la foto');
    }
  };

  const paginas = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <TopBar title="Activos Fijos" />
      <div className="p-4">
        <PageHeader title="Activos Fijos" subtitle={`${total} activo${total === 1 ? '' : 's'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo activo
          </button>
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
              <input className="form-control border-start-0" placeholder="Buscar por código, nombre, marca..." value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
              {busqueda && <button className="btn btn-outline-secondary" onClick={() => { setBusqueda(''); setPagina(1); }}><i className="bi bi-x"></i></button>}
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          {loading ? <div className="card-body"><Spinner /></div> : lista.length === 0 ? (
            <div className="card-body">
              <EmptyState icon="bi-pc-display" title={busqueda ? 'Sin resultados' : 'Sin activos'}
                subtitle={busqueda ? `No hay activos que coincidan con "${busqueda}"` : 'Crea el primer activo con el botón de arriba'}
                action={!busqueda && <button className="btn btn-success mt-2" onClick={abrirNuevo} disabled={!canAdd}><i className="bi bi-plus-lg me-1"></i>Crear ahora</button>} />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Código</th><th>Nombre</th><th>Cant.</th><th>Categoría</th><th>Ubicación</th><th>Estado</th><th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(a => (
                    <tr key={a.id_activo_f}>
                      <td><code className="small">{a.id_activo_f}</code></td>
                      <td className="small fw-semibold">{a.nombre_activo_f}</td>
                      <td className="small text-center">{a.cantidad}</td>
                      <td className="small">{a.categoria}</td>
                      <td className="small">{a.ubicacion}</td>
                      <td className="small">{a.estado_actual}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-primary" onClick={() => abrirEditar(a)} disabled={!canEdit} title="Editar"><i className="bi bi-pencil"></i></button>
                          <button type="button" className="btn btn-outline-danger" onClick={() => eliminar(a)} disabled={!canDel} title="Eliminar"><i className="bi bi-trash"></i></button>
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
                <button className="btn btn-outline-secondary" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}><i className="bi bi-chevron-left"></i></button>
                <button className="btn btn-outline-secondary" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}><i className="bi bi-chevron-right"></i></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: 1080 }}>
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><i className="bi bi-pc-display me-2"></i>{editando ? 'Editar activo' : 'Nuevo activo'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Código <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input className="form-control font-monospace text-uppercase" maxLength={5} required value={form.id_activo_f}
                          disabled={!!editando} onChange={e => setForm(f => ({ ...f, id_activo_f: e.target.value }))} />
                        {!editando && (
                          <button type="button" className="btn btn-outline-secondary" onClick={generarCodigo} title="Generar código">
                            <i className="bi bi-magic"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-md-5">
                      <label className="form-label small fw-semibold">Nombre <span className="text-danger">*</span></label>
                      <input className="form-control" maxLength={20} required value={form.nombre_activo_f}
                        onChange={e => setForm(f => ({ ...f, nombre_activo_f: e.target.value }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Categoría <span className="text-danger">*</span></label>
                      <select className="form-select" required value={form.categoria}
                        onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                        <option value="">Seleccione...</option>
                        {categorias.map(c => <option key={c.categoria} value={c.categoria}>{c.categoria} - {c.nombre_categoria}</option>)}
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold">Cantidad</label>
                      <input type="number" min="1" className="form-control" value={form.cantidad}
                        onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Marca</label>
                      <input className="form-control" maxLength={15} value={form.marca}
                        onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Modelo</label>
                      <input className="form-control" maxLength={10} value={form.modelo}
                        onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">N° de serie</label>
                      <input className="form-control" maxLength={20} value={form.numero_serie}
                        onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Ubicación <span className="text-danger">*</span></label>
                      <select className="form-select" required value={form.ubicacion}
                        onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}>
                        <option value="">Seleccione...</option>
                        {ubicaciones.map(u => <option key={u.ubicacion} value={u.ubicacion}>{u.ubicacion} - {u.descripcion}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Estado actual <span className="text-danger">*</span></label>
                      <select className="form-select" required value={form.estado_actual}
                        onChange={e => setForm(f => ({ ...f, estado_actual: e.target.value }))}>
                        <option value="">Seleccione...</option>
                        {estados.map(e => <option key={e.estado_activo_f} value={e.estado_activo_f}>{e.estado_activo_f} - {e.descripcion_estado_activo_f}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Congregación</label>
                      <select className="form-select" value={form.congregacion}
                        onChange={e => setForm(f => ({ ...f, congregacion: e.target.value }))}>
                        <option value="">Sin congregación</option>
                        {congregaciones.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Responsable</label>
                      <div className="input-group">
                        <input className="form-control" value={respNombre || form.responsable} readOnly placeholder="Sin responsable" />
                        <button type="button" className="btn btn-outline-secondary" onClick={() => setSelectorTercero(true)} title="Buscar tercero">
                          <i className="bi bi-search"></i>
                        </button>
                        {form.responsable && (
                          <button type="button" className="btn btn-outline-danger" onClick={() => { setForm(f => ({ ...f, responsable: '' })); setRespNombre(''); }} title="Quitar">
                            <i className="bi bi-x"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Fecha adquisición</label>
                      <input type="date" className="form-control" value={form.fecha_adquisicion}
                        onChange={e => setForm(f => ({ ...f, fecha_adquisicion: e.target.value }))} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Valor de compra</label>
                      <input type="number" step="0.01" className="form-control" value={form.valor_compra}
                        onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Comentarios</label>
                      <textarea className="form-control" rows={2} maxLength={50} value={form.comentarios}
                        onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} />
                    </div>
                  </div>

                  {editando && (
                    <div className="mt-3">
                      <div className="fw-semibold small mb-2">Fotos del activo (formato 4:3)</div>
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        {fotos.map(f => (
                          <div key={f.id} className="position-relative border rounded" style={{ width: 120 }}>
                            <img src={f.url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4 }}
                              onError={e => { e.target.style.display = 'none'; }} />
                            <button type="button" className="btn btn-sm btn-outline-danger position-absolute top-0 end-0 m-1"
                              onClick={() => quitarFotoActivo(f)} title="Eliminar foto">
                              <i className="bi bi-x"></i>
                            </button>
                            {f.descripcion && <div className="small text-muted px-1">{f.descripcion}</div>}
                          </div>
                        ))}
                        {fotos.length === 0 && <span className="text-muted small fst-italic">Sin fotos</span>}
                      </div>
                      <label className="btn btn-sm btn-outline-success mb-0">
                        {subiendoFoto ? <><span className="spinner-border spinner-border-sm me-1"></span>Subiendo...</> : <><i className="bi bi-upload me-1"></i>Agregar foto</>}
                        <input type="file" className="d-none" accept="image/jpeg,image/png,image/webp"
                          onChange={subirFotoActivoUI} disabled={subiendoFoto} />
                      </label>
                      <div className="form-text">Máx. 5 MB · JPG, PNG o WebP · se recomienda 4:3 (1024×768)</div>
                    </div>
                  )}
                  {!editando && (
                    <div className="mt-3 text-muted small fst-italic">
                      Guarde el activo primero para poder agregar fotos.
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <SelectorTercero
        abierto={selectorTercero}
        cedulaInicial={form.responsable}
        onCerrar={() => setSelectorTercero(false)}
        onElegir={elegirResponsable} />
      <SelectorCongregacion
        abierto={selectorCong}
        codigoInicial={form.congregacion}
        onCerrar={() => setSelectorCong(false)}
        onElegir={c => setForm(f => ({ ...f, congregacion: c.codigo }))} />

      {/* Modal de recorte de foto (formato 4×3) */}
      {showCrop && cropSrc && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 560 }}>
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><i className="bi bi-crop me-2"></i>Encuadrar foto (4×3)</h5>
                <button type="button" className="btn-close btn-close-white" onClick={cancelarRecorteActivo}></button>
              </div>
              <div className="modal-body text-center">
                <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={4 / 3} minWidth={60}>
                  <img ref={imgRef} src={cropSrc} alt="Recortar" onLoad={onImageLoad} style={{ maxHeight: '60vh', maxWidth: '100%' }} />
                </ReactCrop>
                <div className="form-text mt-2">Arrastra el cuadro para encuadrar la foto en formato 4×3.</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={cancelarRecorteActivo}>Cancelar</button>
                <button type="button" className="btn btn-success" onClick={aplicarRecorteActivo}><i className="bi bi-check2 me-1"></i>Aplicar recorte</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
