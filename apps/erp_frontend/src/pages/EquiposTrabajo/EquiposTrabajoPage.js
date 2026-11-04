import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import MultiSelect from '../../components/common/MultiSelect';
import {
  getEquiposTrabajo, createEquipoTrabajo, updateEquipoTrabajo, deleteEquipoTrabajo,
} from '../../api/equiposTrabajo';
import { getAreasTrabajo } from '../../api/areasTrabajo';
import { getCargos } from '../../api/cargos';
import { getCongregaciones } from '../../api/congregaciones';
import SelectorAreaTrabajo from '../../components/common/SelectorAreaTrabajo';
import SelectorCargo from '../../components/common/SelectorCargo';
import SelectorCongregacion from '../../components/common/SelectorCongregacion';
import SelectorMembresia from '../../components/common/SelectorMembresia';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const SELECCION_VACIA = { area: null, cargo: null, congregacion: null, responsable: null };

const PAGE_SIZE = 50;

const FORM_VACIO = {
  area_trabajo: '', cargo: '', congregacion: '', responsable: '',
  vigencia_desde: '', vigencia_hasta: '', comentarios: '',
};

const FILTROS_VACIOS = {
  area: [], cargo: [], congregacion: [],
  vigencia_desde_desde: '', vigencia_desde_hasta: '',
  vigencia_hasta_desde: '', vigencia_hasta_hasta: '',
};

const CABECERAS = [
  { label: 'Área de trabajo', campo: 'area_trabajo__codigo_area' },
  { label: 'Cargo', campo: 'cargo__codigo_cargo' },
  { label: 'Congregación', campo: 'congregacion__nombre' },
  { label: 'Responsable', campo: 'responsable__tercero__apellido1' },
  { label: 'Vigencia desde', campo: 'vigencia_desde' },
  { label: 'Vigencia hasta', campo: 'vigencia_hasta' },
];

const mensajeError = (err, porDefecto) =>
  err?.response?.data?.detail
  || err?.response?.data?.area_trabajo?.[0]
  || err?.response?.data?.cargo?.[0]
  || err?.response?.data?.responsable?.[0]
  || err?.response?.data?.vigencia_desde?.[0]
  || err?.response?.data?.vigencia_hasta?.[0]
  || porDefecto;

const fechaInput = (valor) => {
  if (!valor) return '';
  return String(valor).split('T')[0];
};

const fechaLocal = (valor) => {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

export default function EquiposTrabajoPage() {
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [orden, setOrden] = useState({ campo: 'area_trabajo__codigo_area', direccion: 'asc' });
  const [opciones, setOpciones] = useState({ areas: [], cargos: [], congregaciones: [] });
  const [filtroResponsable, setFiltroResponsable] = useState(null);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selector, setSelector] = useState(null); // 'area' | 'cargo' | 'congregacion' | 'responsable'
  const [selectorFiltroResponsable, setSelectorFiltroResponsable] = useState(false);
  const [seleccion, setSeleccion] = useState(SELECCION_VACIA);

  useEffect(() => {
    getAreasTrabajo({ page_size: 10000 })
      .then(r => setOpciones(o => ({ ...o, areas: r.data.results || r.data || [] })))
      .catch(() => {});
    getCargos({ page_size: 10000 })
      .then(r => setOpciones(o => ({ ...o, cargos: r.data.results || r.data || [] })))
      .catch(() => {});
    getCongregaciones({ page_size: 10000 })
      .then(r => setOpciones(o => ({ ...o, congregaciones: r.data.results || r.data || [] })))
      .catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda.trim()) params.search = busqueda.trim();

    if (filtros.area.length) params.area = filtros.area.join(',');
    if (filtros.cargo.length) params.cargo = filtros.cargo.join(',');
    if (filtros.congregacion.length) params.congregacion = filtros.congregacion.join(',');
    if (filtroResponsable?.tercero?.cedula) params.responsable = filtroResponsable.tercero.cedula;

    if (filtros.vigencia_desde_desde) params.vigencia_desde_gte = filtros.vigencia_desde_desde;
    if (filtros.vigencia_desde_hasta) params.vigencia_desde_lte = filtros.vigencia_desde_hasta;
    if (filtros.vigencia_hasta_desde) params.vigencia_hasta_gte = filtros.vigencia_hasta_desde;
    if (filtros.vigencia_hasta_hasta) params.vigencia_hasta_lte = filtros.vigencia_hasta_hasta;

    const prefix = orden.direccion === 'desc' ? '-' : '';
    params.ordering = `${prefix}${orden.campo}`;

    return params;
  }, [pagina, busqueda, filtros, filtroResponsable, orden]);

  const cargar = useCallback(() => {
    setLoading(true);
    getEquiposTrabajo(buildParams())
      .then(r => {
        setLista(r.data.results || []);
        setTotal(r.data.count || 0);
      })
      .catch(() => toast.error('No se pudieron cargar los equipos de trabajo'))
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => { cargar(); }, [cargar]);

  const hayFiltros = busqueda
    || filtros.area.length || filtros.cargo.length || filtros.congregacion.length
    || filtroResponsable
    || filtros.vigencia_desde_desde || filtros.vigencia_desde_hasta
    || filtros.vigencia_hasta_desde || filtros.vigencia_hasta_hasta;

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltros(FILTROS_VACIOS);
    setFiltroResponsable(null);
    setPagina(1);
  };

  const cambiarOrden = (campo) => {
    setOrden(o => ({
      campo,
      direccion: o.campo === campo && o.direccion === 'asc' ? 'desc' : 'asc',
    }));
    setPagina(1);
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setSeleccion(SELECCION_VACIA);
    setModal(true);
  };

  const abrirEditar = (e) => {
    setEditando(e);
    setForm({
      area_trabajo: e.area_trabajo || '',
      cargo: e.cargo || '',
      congregacion: e.congregacion || '',
      responsable: e.responsable || '',
      vigencia_desde: fechaInput(e.vigencia_desde),
      vigencia_hasta: fechaInput(e.vigencia_hasta),
      comentarios: e.comentarios || '',
    });
    setSeleccion({
      area: e.area_trabajo ? { codigo_area: e.area_trabajo, nombre_area: e.area_trabajo_nombre } : null,
      cargo: e.cargo ? { codigo_cargo: e.cargo, nombre_cargo: e.cargo_nombre } : null,
      congregacion: e.congregacion ? { codigo: e.congregacion, nombre: e.congregacion_nombre } : null,
      responsable: e.responsable ? { tercero: { cedula: e.responsable }, nombre_completo: e.responsable_nombre } : null,
    });
    setModal(true);
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    if (!form.area_trabajo || !form.cargo || !form.responsable) {
      toast.error('Área de trabajo, cargo y responsable son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        area_trabajo: form.area_trabajo || null,
        cargo: form.cargo || null,
        congregacion: form.congregacion || null,
        responsable: form.responsable || null,
        vigencia_desde: form.vigencia_desde || null,
        vigencia_hasta: form.vigencia_hasta || null,
        comentarios: form.comentarios.trim(),
      };
      if (editando) {
        await updateEquipoTrabajo(editando.id, payload);
        toast.success('Equipo de trabajo actualizado');
      } else {
        await createEquipoTrabajo(payload);
        toast.success('Equipo de trabajo creado');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'Error al guardar el equipo de trabajo'));
    } finally { setSaving(false); }
  };

  const eliminar = async (e) => {
    if (!window.confirm(`¿Eliminar este registro del equipo de trabajo?`)) return;
    try {
      await deleteEquipoTrabajo(e.id);
      toast.success('Equipo de trabajo eliminado');
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar el equipo de trabajo'));
    }
  };

  const paginas = Math.ceil(total / PAGE_SIZE);

  const displayArea = seleccion.area
    ? `${seleccion.area.codigo_area} — ${seleccion.area.nombre_area}` : '';
  const displayCargo = seleccion.cargo
    ? `${seleccion.cargo.codigo_cargo} — ${seleccion.cargo.nombre_cargo}` : '';
  const displayCongregacion = seleccion.congregacion
    ? `${seleccion.congregacion.codigo} — ${seleccion.congregacion.nombre}` : '';
  const displayResponsable = seleccion.responsable
    ? `${seleccion.responsable.tercero?.cedula} — ${seleccion.responsable.nombre_completo}` : '';

  const campoBusqueda = (label, obligatorio, display, onAbrir, onLimpiar) => (
    <div>
      <label className="form-label small fw-semibold">
        {label} {obligatorio && <span className="text-danger">*</span>}
      </label>
      <div className="input-group">
        <input className="form-control bg-white" value={display || '—'} readOnly
          placeholder={`Seleccione ${label.toLowerCase()}`} />
        <button type="button" className="btn btn-outline-success" onClick={onAbrir} title={`Buscar ${label.toLowerCase()}`}>
          <i className="bi bi-search"></i>
        </button>
        {display && (
          <button type="button" className="btn btn-outline-danger" onClick={onLimpiar} title="Limpiar">
            <i className="bi bi-x"></i>
          </button>
        )}
      </div>
    </div>
  );

  const CabeceraOrdenable = ({ label, campo }) => {
    const activo = orden.campo === campo;
    const icono = activo
      ? (orden.direccion === 'asc' ? 'bi-sort-up' : 'bi-sort-down')
      : 'bi-arrow-down-up text-white-50';
    return (
      <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => cambiarOrden(campo)}>
        {label} <i className={`bi ${icono} ms-1 small`}></i>
      </th>
    );
  };

  return (
    <MainLayout>
      <TopBar title="Equipos de Trabajo" />
      <div className="p-4">
        <PageHeader title="Equipos de Trabajo"
          subtitle={`${total} registro${total === 1 ? '' : 's'}`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo registro
          </button>
        </PageHeader>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-6 col-lg-2">
                <label className="form-label small mb-1">Área de trabajo</label>
                <MultiSelect
                  options={opciones.areas}
                  value={filtros.area}
                  getKey={a => a.codigo_area}
                  getLabel={a => `${a.codigo_area} — ${a.nombre_area}`}
                  onChange={v => { setFiltros(f => ({ ...f, area: v })); setPagina(1); }}
                />
              </div>
              <div className="col-md-6 col-lg-2">
                <label className="form-label small mb-1">Cargo</label>
                <MultiSelect
                  options={opciones.cargos}
                  value={filtros.cargo}
                  getKey={c => c.codigo_cargo}
                  getLabel={c => `${c.codigo_cargo} — ${c.nombre_cargo}`}
                  onChange={v => { setFiltros(f => ({ ...f, cargo: v })); setPagina(1); }}
                />
              </div>
              <div className="col-md-6 col-lg-2">
                <label className="form-label small mb-1">Congregación</label>
                <MultiSelect
                  options={opciones.congregaciones}
                  value={filtros.congregacion}
                  getKey={c => c.codigo}
                  getLabel={c => `${c.codigo} — ${c.nombre}`}
                  onChange={v => { setFiltros(f => ({ ...f, congregacion: v })); setPagina(1); }}
                />
              </div>
              <div className="col-md-6 col-lg-3">
                <label className="form-label small mb-1">Responsable</label>
                <div className="input-group input-group-sm">
                  <input className="form-control bg-white" readOnly
                    value={filtroResponsable ? `${filtroResponsable.tercero?.cedula} — ${filtroResponsable.nombre_completo}` : ''}
                    placeholder="Buscar responsable..." />
                  <button type="button" className="btn btn-outline-success"
                    onClick={() => setSelectorFiltroResponsable(true)} title="Buscar responsable">
                    <i className="bi bi-search"></i>
                  </button>
                  {filtroResponsable && (
                    <button type="button" className="btn btn-outline-danger"
                      onClick={() => { setFiltroResponsable(null); setPagina(1); }} title="Limpiar">
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="col-md-6 col-lg-3">
                <div className="d-flex align-items-end gap-2">
                  <button className="btn btn-primary btn-sm flex-grow-1" onClick={() => { setPagina(1); cargar(); }}>
                    <i className="bi bi-search me-1"></i>Buscar
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" title="Limpiar filtros" onClick={limpiarFiltros}>
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              </div>
            </div>
            <div className="row g-2 mt-1 align-items-end">
              <div className="col-md-6 col-lg-3">
                <label className="form-label small mb-1">Vigencia desde</label>
                <div className="input-group input-group-sm">
                  <input type="date" className="form-control" value={filtros.vigencia_desde_desde}
                    onChange={e => { setFiltros(f => ({ ...f, vigencia_desde_desde: e.target.value })); setPagina(1); }} />
                  <span className="input-group-text">a</span>
                  <input type="date" className="form-control" value={filtros.vigencia_desde_hasta}
                    onChange={e => { setFiltros(f => ({ ...f, vigencia_desde_hasta: e.target.value })); setPagina(1); }} />
                </div>
              </div>
              <div className="col-md-6 col-lg-3">
                <label className="form-label small mb-1">Vigencia hasta</label>
                <div className="input-group input-group-sm">
                  <input type="date" className="form-control" value={filtros.vigencia_hasta_desde}
                    onChange={e => { setFiltros(f => ({ ...f, vigencia_hasta_desde: e.target.value })); setPagina(1); }} />
                  <span className="input-group-text">a</span>
                  <input type="date" className="form-control" value={filtros.vigencia_hasta_hasta}
                    onChange={e => { setFiltros(f => ({ ...f, vigencia_hasta_hasta: e.target.value })); setPagina(1); }} />
                </div>
              </div>
              <div className="col-md-12 col-lg-6">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
                  <input className="form-control border-start-0"
                    placeholder="Buscar por área, cargo o responsable..."
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
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          {loading ? (
            <div className="card-body"><Spinner /></div>
          ) : lista.length === 0 ? (
            <div className="card-body">
              <EmptyState icon="bi-people-fill"
                title={hayFiltros ? 'Sin resultados' : 'Sin equipos de trabajo'}
                subtitle={hayFiltros
                  ? 'Ajusta los filtros o la búsqueda para ver registros'
                  : 'Crea el primer registro con el botón de arriba'}
                action={!hayFiltros && (
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
                    {CABECERAS.map(h => (
                      <CabeceraOrdenable key={h.campo} label={h.label} campo={h.campo} />
                    ))}
                    <th className="text-center"><i className="bi bi-chat-left-text"></i></th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(e => (
                    <tr key={e.id}>
                      <td>
                        <span className="badge bg-dark font-monospace me-1">{e.area_trabajo}</span>
                        {e.area_trabajo_nombre}
                      </td>
                      <td>
                        <span className="badge bg-secondary font-monospace me-1">{e.cargo}</span>
                        {e.cargo_nombre}
                      </td>
                      <td>
                        {e.congregacion
                          ? <><span className="badge bg-info text-dark font-monospace me-1">{e.congregacion}</span>{e.congregacion_nombre}</>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>{e.responsable_nombre}</td>
                      <td>{fechaLocal(e.vigencia_desde)}</td>
                      <td>{fechaLocal(e.vigencia_hasta)}</td>
                      <td className="text-center">
                        {e.comentarios?.trim() ? (
                          <i className="bi bi-chat-left-text-fill text-success fs-5"
                            title={e.comentarios.trim()} style={{ cursor: 'help' }}></i>
                        ) : (
                          <i className="bi bi-chat-left-text text-muted opacity-25 fs-5"></i>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary"
                            onClick={() => abrirEditar(e)} title="Editar" disabled={!canEdit}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger"
                            onClick={() => eliminar(e)} title="Eliminar" disabled={!canDel}>
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

      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-people-fill me-2"></i>
                  {editando ? 'Editar equipo de trabajo' : 'Nuevo equipo de trabajo'}
                </h5>
                <button className="btn-close btn-close-white"
                  onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      {campoBusqueda('Área de trabajo', true, displayArea,
                        () => setSelector('area'),
                        () => { setForm(f => ({ ...f, area_trabajo: '' })); setSeleccion(s => ({ ...s, area: null })); })}
                    </div>
                    <div className="col-md-6">
                      {campoBusqueda('Cargo', true, displayCargo,
                        () => setSelector('cargo'),
                        () => { setForm(f => ({ ...f, cargo: '' })); setSeleccion(s => ({ ...s, cargo: null })); })}
                    </div>
                    <div className="col-md-6">
                      {campoBusqueda('Congregación', false, displayCongregacion,
                        () => setSelector('congregacion'),
                        () => { setForm(f => ({ ...f, congregacion: '' })); setSeleccion(s => ({ ...s, congregacion: null })); })}
                    </div>
                    <div className="col-md-6">
                      {campoBusqueda('Responsable', true, displayResponsable,
                        () => setSelector('responsable'),
                        () => { setForm(f => ({ ...f, responsable: '' })); setSeleccion(s => ({ ...s, responsable: null })); })}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Vigencia desde</label>
                      <input type="date" className="form-control" value={form.vigencia_desde}
                        onChange={e => setForm({ ...form, vigencia_desde: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Vigencia hasta</label>
                      <input type="date" className="form-control" value={form.vigencia_hasta}
                        onChange={e => setForm({ ...form, vigencia_hasta: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Comentarios</label>
                      <textarea className="form-control" rows={3} value={form.comentarios}
                        placeholder="Comentarios adicionales"
                        onChange={e => setForm({ ...form, comentarios: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {selector === 'area' && (
        <SelectorAreaTrabajo
          abierto
          codigoInicial={form.area_trabajo}
          onCerrar={() => setSelector(null)}
          onElegir={item => {
            setForm(f => ({ ...f, area_trabajo: item.codigo_area }));
            setSeleccion(s => ({ ...s, area: item }));
          }}
        />
      )}
      {selector === 'cargo' && (
        <SelectorCargo
          abierto
          codigoInicial={form.cargo}
          onCerrar={() => setSelector(null)}
          onElegir={item => {
            setForm(f => ({ ...f, cargo: item.codigo_cargo }));
            setSeleccion(s => ({ ...s, cargo: item }));
          }}
        />
      )}
      {selector === 'congregacion' && (
        <SelectorCongregacion
          abierto
          codigoInicial={form.congregacion}
          onCerrar={() => setSelector(null)}
          onElegir={item => {
            setForm(f => ({ ...f, congregacion: item.codigo }));
            setSeleccion(s => ({ ...s, congregacion: item }));
          }}
        />
      )}
      {selector === 'responsable' && (
        <SelectorMembresia
          abierto
          cedulaInicial={form.responsable}
          onCerrar={() => setSelector(null)}
          onElegir={item => {
            setForm(f => ({ ...f, responsable: item.tercero?.cedula || '' }));
            setSeleccion(s => ({ ...s, responsable: item }));
          }}
        />
      )}

      {selectorFiltroResponsable && (
        <SelectorMembresia
          abierto
          cedulaInicial={filtroResponsable?.tercero?.cedula || ''}
          onCerrar={() => setSelectorFiltroResponsable(false)}
          onElegir={item => {
            setFiltroResponsable(item);
            setPagina(1);
          }}
        />
      )}
    </MainLayout>
  );
}
