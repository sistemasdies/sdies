import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import {
  getPastores, createPastor,
  updatePastor, deletePastor,
} from '../../api/pastores';
import { getMembresias } from '../../api/membresias';
import { getEstadosPastor } from '../../api/estados_pastor';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const PAGE_SIZE = 50;

const FORM_VACIO = {
  codigo_pastor: '', tipo_licencia: '1', estado_pastor: '1', nombre_pastor_postulante: '',
  fecha_licencia_fase1: '', lugar_aprobado_fase1: '', aprobado_fase1_por: '',
  fecha_licencia_fase2: '', lugar_aprobado_fase2: '', aprobado_fase2_por: '',
  fecha_licencia_general: '', lugar_aprobado_general: '', aprobado_general_por: '',
  fecha_licencia_ordenacion: '', lugar_aprobado_ordenacion: '', aprobado_ordenacion_por: '',
  comentarios: '',
};

const mensajeError = (err, porDefecto) =>
  err?.response?.data?.detail
  || err?.response?.data?.codigo_pastor?.[0]
  || err?.response?.data?.nombre_pastor_postulante?.[0]
  || porDefecto;

export default function PastoresPage() {
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
  const [estadosPastor, setEstadosPastor] = useState([]);

  // Lupa de membresía
  const [lupaPastor, setLupaPastor] = useState(false);
  const [listaMembresias, setListaMembresias] = useState([]);
  const [busqPastor, setBusqPastor] = useState('');
  const [loadingPastor, setLoadingPastor] = useState(false);

  const abrirLupaPastor = () => {
    setBusqPastor('');
    setLupaPastor(true);
    setLoadingPastor(true);
    getMembresias({ page: 1, page_size: 100 })
      .then(r => setListaMembresias(r.data.results || []))
      .catch(() => toast.error('No se pudieron cargar las membresías'))
      .finally(() => setLoadingPastor(false));
  };

  const buscarPastor = (termino) => {
    setBusqPastor(termino);
    setLoadingPastor(true);
    const params = { page: 1, page_size: 100 };
    if (termino.trim()) params.search = termino.trim();
    getMembresias(params)
      .then(r => setListaMembresias(r.data.results || []))
      .catch(() => toast.error('No se pudieron cargar las membresías'))
      .finally(() => setLoadingPastor(false));
  };

  const elegirPastor = (m) => {
    const cedula = m?.tercero?.cedula || m?.tercero_id || '';
    setForm(f => ({ ...f, codigo_pastor: cedula }));
    setLupaPastor(false);
  };

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda.trim()) params.search = busqueda.trim();
    getPastores(params)
      .then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar los pastores'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  const cargarEstadosPastor = () => {
    getEstadosPastor({ page_size: 100 })
      .then(r => setEstadosPastor(r.data.results || []))
      .catch(() => {});
  };
  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); cargarEstadosPastor(); setModal(true); };

  const abrirEditar = (p) => {
    cargarEstadosPastor();
    setEditando(p);
    setForm({
      codigo_pastor: p.codigo_pastor || '',
      tipo_licencia: p.tipo_licencia || '1',
      estado_pastor: p.estado_pastor || '1',
      nombre_pastor_postulante: p.nombre_pastor_postulante || '',
      fecha_licencia_fase1: p.fecha_licencia_fase1 || '',
      lugar_aprobado_fase1: p.lugar_aprobado_fase1 || '',
      aprobado_fase1_por: p.aprobado_fase1_por || '',
      fecha_licencia_fase2: p.fecha_licencia_fase2 || '',
      lugar_aprobado_fase2: p.lugar_aprobado_fase2 || '',
      aprobado_fase2_por: p.aprobado_fase2_por || '',
      fecha_licencia_general: p.fecha_licencia_general || '',
      lugar_aprobado_general: p.lugar_aprobado_general || '',
      aprobado_general_por: p.aprobado_general_por || '',
      fecha_licencia_ordenacion: p.fecha_licencia_ordenacion || '',
      lugar_aprobado_ordenacion: p.lugar_aprobado_ordenacion || '',
      aprobado_ordenacion_por: p.aprobado_ordenacion_por || '',
      comentarios: p.comentarios || '',
    });
    setModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      // vaciar fechas vacías
      ['fecha_licencia_fase1','fecha_licencia_fase2','fecha_licencia_general','fecha_licencia_ordenacion']
        .forEach(k => { if (!payload[k]) payload[k] = null; });
      if (editando) {
        await updatePastor(editando.id, payload);
        toast.success('Pastor actualizado');
      } else {
        await createPastor(payload);
        toast.success('Pastor creado');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'Error al guardar el pastor'));
    } finally { setSaving(false); }
  };

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar el pastor "${p.codigo_pastor} - ${p.nombre_pastor_postulante}"?`)) return;
    try {
      await deletePastor(p.id);
      toast.success('Pastor eliminado');
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar el pastor'));
    }
  };

  const paginas = Math.ceil(total / PAGE_SIZE);

  const campo = (label, key, tipo = 'text', ancho = 'col-md-4') => (
    <div className={ancho}>
      <label className="form-label small fw-semibold">{label}</label>
      <input type={tipo} className="form-control" value={form[key] ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  return (
    <MainLayout>
      <TopBar title="Pastores" />
      <div className="p-4">
        <PageHeader title="Pastores"
          subtitle={`${total} pastor${total === 1 ? '' : 'es'} registrado${total === 1 ? '' : 's'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo pastor
          </button>
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
              <input className="form-control border-start-0"
                placeholder="Buscar por cédula, nombre o comentarios..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
              {busqueda && (
                <button className="btn btn-outline-secondary" onClick={() => { setBusqueda(''); setPagina(1); }}>
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
              <EmptyState icon="bi-person-badge"
                title={busqueda ? 'Sin resultados' : 'Sin pastores'}
                subtitle={busqueda ? `No hay pastores que coincidan con "${busqueda}"` : 'Crea el primer pastor con el botón de arriba'}
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
                    <th>F. lic. general</th>
                    <th>Comentarios</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(p => (
                    <tr key={p.id}>
                      <td><code className="small">{p.codigo_pastor}</code></td>
                      <td className="small fw-semibold">{p.pastor_nombre || p.nombre_pastor_postulante || '—'}</td>
                      <td className="small">{p.fecha_licencia_general || '—'}</td>
                      <td className="small text-muted">{p.comentarios || '—'}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-primary" onClick={() => abrirEditar(p)} disabled={!canEdit} title="Editar">
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button type="button" className="btn btn-outline-danger" onClick={() => eliminar(p)} disabled={!canDel} title="Eliminar">
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
                <button className="btn btn-outline-secondary" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button className="btn btn-outline-secondary" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>
                  <i className="bi bi-chevron-right"></i>
                </button>
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
                <h5 className="modal-title">
                  <i className="bi bi-person-badge me-2"></i>
                  {editando ? 'Editar pastor' : 'Nuevo pastor'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Código pastor (cédula) <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input className="form-control font-monospace" maxLength={12} required
                          value={form.codigo_pastor}
                          disabled={!!editando}
                          onChange={e => setForm(f => ({ ...f, codigo_pastor: e.target.value }))} />
                        {!editando && (
                          <button type="button" className="btn btn-outline-secondary" onClick={abrirLupaPastor} title="Buscar membresía">
                            <i className="bi bi-search"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Tipo de licencia <span className="text-danger">*</span></label>
                      <select className="form-select" value={form.tipo_licencia}
                        onChange={e => setForm(f => ({ ...f, tipo_licencia: e.target.value }))}>
                        <option value="1">1 - Miembro en Proceso de Formación Ministerial Fase 1</option>
                        <option value="2">2 - Miembro en Proceso de Formación Ministerial Fase 2</option>
                        <option value="3">3 - Ministro de culto fase 1 (Licencia General)</option>
                        <option value="4">4 - Ministro de culto fase 2 (Licencia Ordenación)</option>
                        <option value="5">5 - Misionero (Licencia Ordenación)</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Nombre pastor postulante</label>
                      <input className="form-control" maxLength={30}
                        value={form.nombre_pastor_postulante}
                        onChange={e => setForm(f => ({ ...f, nombre_pastor_postulante: e.target.value }))} />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Estado pastor</label>
                      <select className="form-select" value={form.estado_pastor}
                        onChange={e => setForm(f => ({ ...f, estado_pastor: e.target.value }))}>
                        {estadosPastor.length === 0 && <option value={form.estado_pastor}>{form.estado_pastor}</option>}
                        {estadosPastor.map(e => (
                          <option key={e.estado} value={e.estado}>{e.estado} - {e.descripcion}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <h6 className="fw-bold small text-success border-bottom pb-1 mb-2">Fase 1</h6>
                  <div className="row g-3 mb-3">
                    {campo('Fecha licencia Fase 1', 'fecha_licencia_fase1', 'date', 'col-md-4')}
                    {campo('Lugar aprobado Fase 1', 'lugar_aprobado_fase1', 'text', 'col-md-4')}
                    {campo('Aprobado Fase 1 por', 'aprobado_fase1_por', 'text', 'col-md-4')}
                  </div>

                  <h6 className="fw-bold small text-success border-bottom pb-1 mb-2">Fase 2</h6>
                  <div className="row g-3 mb-3">
                    {campo('Fecha licencia Fase 2', 'fecha_licencia_fase2', 'date', 'col-md-4')}
                    {campo('Lugar aprobado Fase 2', 'lugar_aprobado_fase2', 'text', 'col-md-4')}
                    {campo('Aprobado Fase 2 por', 'aprobado_fase2_por', 'text', 'col-md-4')}
                  </div>

                  <h6 className="fw-bold small text-success border-bottom pb-1 mb-2">General</h6>
                  <div className="row g-3 mb-3">
                    {campo('Fecha licencia General', 'fecha_licencia_general', 'date', 'col-md-4')}
                    {campo('Lugar aprobado General', 'lugar_aprobado_general', 'text', 'col-md-4')}
                    {campo('Aprobado General por', 'aprobado_general_por', 'text', 'col-md-4')}
                  </div>

                  <h6 className="fw-bold small text-success border-bottom pb-1 mb-2">Ordenación</h6>
                  <div className="row g-3 mb-3">
                    {campo('Fecha licencia Ordenación', 'fecha_licencia_ordenacion', 'date', 'col-md-4')}
                    {campo('Lugar aprobado Ordenación', 'lugar_aprobado_ordenacion', 'text', 'col-md-4')}
                    {campo('Aprobado Ordenación por', 'aprobado_ordenacion_por', 'text', 'col-md-4')}
                  </div>

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Comentarios</label>
                      <textarea className="form-control" rows={3} maxLength={200}
                        value={form.comentarios}
                        onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Lupa de membresía */}
      {lupaPastor && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><i className="bi bi-search me-2"></i>Seleccionar membresía</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setLupaPastor(false)}></button>
              </div>
              <div className="modal-body">
                <div className="input-group mb-3">
                  <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
                  <input className="form-control border-start-0"
                    placeholder="Buscar por cédula o nombre..."
                    value={busqPastor}
                    onChange={e => buscarPastor(e.target.value)} />
                </div>
                {loadingPastor ? (
                  <Spinner />
                ) : listaMembresias.length === 0 ? (
                  <EmptyState icon="bi-people" title="Sin membresías" subtitle="No hay membresías que coincidan" />
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '50vh' }}>
                    <table className="table table-hover table-sm mb-0 align-middle">
                      <thead className="table-dark" style={{ position: 'sticky', top: 0 }}>
                        <tr>
                          <th>Cédula</th>
                          <th>Nombre</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaMembresias.map(m => (
                          <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => elegirPastor(m)}>
                            <td><code className="small">{m.tercero?.cedula}</code></td>
                            <td className="small">{m.nombre_completo}</td>
                            <td className="small">{m.estado}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setLupaPastor(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
