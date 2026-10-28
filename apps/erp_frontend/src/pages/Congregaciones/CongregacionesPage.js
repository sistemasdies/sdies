import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';

import {
  getCongregaciones, createCongregacion,
  updateCongregacion, deleteCongregacion,
} from '../../api/congregaciones';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';
import { getPastores } from '../../api/pastores';

const PAGE_SIZE = 50;

const FORM_VACIO = { codigo: '', nombre: '', direccion: '', pastor: '' };

const mensajeError = (err, porDefecto) =>
  err?.response?.data?.detail
  || err?.response?.data?.codigo?.[0]
  || err?.response?.data?.nombre?.[0]
  || err?.response?.data?.pastor?.[0]
  || porDefecto;

export default function CongregacionesPage() {
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  const [lista,      setLista]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busqueda,   setBusqueda]   = useState('');
  const [pagina,     setPagina]     = useState(1);
  const [total,      setTotal]      = useState(0);

  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(FORM_VACIO);
  const [editando,   setEditando]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [pastorSel,  setPastorSel]  = useState(null);



  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda.trim()) params.search = busqueda.trim();
    getCongregaciones(params)
      .then(r => {
        setLista(r.data.results || []);
        setTotal(r.data.count || 0);
      })
      .catch(() => toast.error('No se pudieron cargar las congregaciones'))
      .finally(() => setLoading(false));
  }, [pagina, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setPastorSel(null);
    setModal(true);
  };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({
      codigo: c.codigo || '',
      nombre: c.nombre || '',
      direccion: c.direccion || '',
      pastor: c.pastor || '',
    });
    setPastorSel(c.pastor ? { cedula: c.pastor, nombre_completo: c.pastor_nombre } : null);
    setModal(true);
  };

  const [lupaPastor, setLupaPastor] = useState(false);
  const [listaPastores, setListaPastores] = useState([]);
  const [busqPastor, setBusqPastor] = useState('');
  const [loadingPastor, setLoadingPastor] = useState(false);

  const abrirLupaPastor = () => {
    setBusqPastor('');
    setLupaPastor(true);
    setLoadingPastor(true);
    getPastores({ page: 1, page_size: 100 })
      .then(r => setListaPastores(r.data.results || []))
      .catch(() => toast.error('No se pudieron cargar los pastores'))
      .finally(() => setLoadingPastor(false));
  };

  const buscarPastorLupa = (termino) => {
    setBusqPastor(termino);
    setLoadingPastor(true);
    const params = { page: 1, page_size: 100 };
    if (termino.trim()) params.search = termino.trim();
    getPastores(params)
      .then(r => setListaPastores(r.data.results || []))
      .catch(() => toast.error('No se pudieron cargar los pastores'))
      .finally(() => setLoadingPastor(false));
  };

  const elegirPastor = (p) => {
    const cedula = p?.codigo_pastor || '';
    setForm(f => ({ ...f, pastor: cedula }));
    setPastorSel({ cedula, nombre_completo: p?.pastor_nombre || p?.nombre_pastor_postulante || '' });
    setLupaPastor(false);
  };

  const quitarPastor = () => {
    setForm(f => ({ ...f, pastor: '' }));
    setPastorSel(null);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim(),
        pastor: form.pastor || null,
      };
      if (editando) {
        await updateCongregacion(editando.id, payload);
        toast.success('Congregación actualizada');
      } else {
        await createCongregacion(payload);
        toast.success('Congregación creada');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'Error al guardar la congregación'));
    } finally { setSaving(false); }
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar la congregación "${c.codigo} - ${c.nombre}"?`)) return;
    try {
      await deleteCongregacion(c.id);
      toast.success('Congregación eliminada');
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar la congregación'));
    }
  };

  const paginas = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <TopBar title="Congregaciones" />
      <div className="p-4">
        <PageHeader title="Congregaciones"
          subtitle={`${total} congregación${total === 1 ? '' : 'es'} registrada${total === 1 ? '' : 's'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nueva congregación
          </button>
        </PageHeader>

        {/* Buscador */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input className="form-control border-start-0"
                placeholder="Buscar por código, nombre, dirección o pastor..."
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

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          {loading ? (
            <div className="card-body"><Spinner /></div>
          ) : lista.length === 0 ? (
            <div className="card-body">
              <EmptyState icon="bi-house-door"
                title={busqueda ? 'Sin resultados' : 'Sin congregaciones'}
                subtitle={busqueda
                  ? `No hay congregaciones que coincidan con "${busqueda}"`
                  : 'Crea la primera congregación con el botón de arriba'}
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
                    <th>Dirección</th>
                    <th>Pastor</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(c => (
                    <tr key={c.id}>
                      <td>
                        <span className="badge bg-dark fs-6 fw-normal font-monospace">
                          {c.codigo}
                        </span>
                      </td>
                      <td className="fw-semibold">{c.nombre}</td>
                      <td className="small text-muted">
                        {c.direccion || <span className="fst-italic">Sin dirección</span>}
                      </td>
                      <td className="small text-muted">
                        {c.pastor_nombre
                          ? <><code className="me-1">{c.pastor}</code>{c.pastor_nombre}</>
                          : <span className="fst-italic">Sin pastor</span>}
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

      {/* Modal */}
      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-house-door me-2"></i>
                  {editando ? 'Editar congregación' : 'Nueva congregación'}
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
                        maxLength={4} value={form.codigo} required
                        placeholder="Ej: C001"
                        onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} />
                      <div className="form-text">Máximo 4 caracteres, único</div>
                    </div>
                    <div className="col-8">
                      <label className="form-label small fw-semibold">
                        Nombre <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" maxLength={12} value={form.nombre} required
                        placeholder="Nombre de la congregación"
                        onChange={e => setForm({ ...form, nombre: e.target.value })} />
                      <div className="form-text">Máximo 12 caracteres</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Dirección</label>
                      <input className="form-control" maxLength={40} value={form.direccion}
                        placeholder="Dirección de la congregación (opcional)"
                        onChange={e => setForm({ ...form, direccion: e.target.value })} />
                      <div className="form-text">Máximo 40 caracteres</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Pastor</label>

                      {pastorSel ? (
                        <div className="input-group">
                          <span className="input-group-text bg-white">
                            <code className="me-1">{pastorSel.cedula}</code>
                            {pastorSel.nombre_completo || <span className="text-muted fst-italic">sin nombre</span>}
                          </span>
                          <button type="button" className="btn btn-outline-danger"
                            onClick={quitarPastor} title="Quitar pastor">
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="btn btn-outline-primary w-100"
                          onClick={abrirLupaPastor}>
                          <i className="bi bi-search me-1"></i>Buscar pastor
                        </button>
                      )}
                      <div className="form-text">
                        Opcional — la lupa busca entre los terceros por cédula, nombre, apellido o celular
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary"
                    onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success"
                    disabled={saving || (editando ? !canEdit : !canAdd)}>
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

      {/* Lupa de búsqueda de pastor (tabla Pastores) */}
      {lupaPastor && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><i className="bi bi-search me-2"></i>Seleccionar pastor</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setLupaPastor(false)}></button>
              </div>
              <div className="modal-body">
                <div className="input-group mb-3">
                  <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
                  <input className="form-control border-start-0"
                    placeholder="Buscar por cédula o nombre..."
                    value={busqPastor}
                    onChange={e => buscarPastorLupa(e.target.value)} />
                </div>
                {loadingPastor ? (
                  <Spinner />
                ) : listaPastores.length === 0 ? (
                  <EmptyState icon="bi-person-badge" title="Sin pastores" subtitle="No hay pastores que coincidan" />
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '50vh' }}>
                    <table className="table table-hover table-sm mb-0 align-middle">
                      <thead className="table-dark" style={{ position: 'sticky', top: 0 }}>
                        <tr>
                          <th>Cédula</th>
                          <th>Nombre</th>
                          <th>Tipo licencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaPastores.map(p => (
                          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => elegirPastor(p)}>
                            <td><code className="small">{p.codigo_pastor}</code></td>
                            <td className="small">{p.pastor_nombre || p.nombre_pastor_postulante || '—'}</td>
                            <td className="small">{p.tipo_licencia}</td>
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
