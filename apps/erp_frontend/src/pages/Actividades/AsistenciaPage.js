import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import SelectorCongregacion from '../../components/common/SelectorCongregacion';
import MultiSelect from '../../components/common/MultiSelect';
import { usePerm } from '../../hooks/usePerm';
import { getAsistencias, createAsistencia, updateAsistencia, deleteAsistencia } from '../../api/actividades';
import { getCongregaciones } from '../../api/congregaciones';
import { formatDate } from '../../utils/formato';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;
const FORM_VACIO = {
  id: '', fecha: '', congregacion: '', creyentes: 0, simpatizantes: 0,
  visitas: 0, ninos: 0, online: 0, tema_predicacion: '', comentarios: '',
};

export default function AsistenciaPage() {
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const hoy = new Date();
  const haceUnAno = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
  const [filtros, setFiltros] = useState({
    congregaciones: [],
    fecha_desde: haceUnAno.toISOString().split('T')[0],
    fecha_hasta: hoy.toISOString().split('T')[0],
  });

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orden, setOrden] = useState({ campo: 'fecha', dir: 'desc' });

  const [congregaciones, setCongregaciones] = useState([]);
  const [selectorCong, setSelectorCong] = useState(false);
  const [modalGrafico, setModalGrafico] = useState(false);
  const [tipoGrafico, setTipoGrafico] = useState('barras');
  const [modoGrafico, setModoGrafico] = useState('totales');
  const [datosGraficoLista, setDatosGraficoLista] = useState([]);

  const buildBaseParams = useCallback(() => {
    const params = {};
    if (busqueda.trim()) params.search = busqueda.trim();
    if (filtros.congregaciones.length) params.congregacion = filtros.congregaciones;
    if (filtros.fecha_desde) params.fecha__gte = filtros.fecha_desde;
    if (filtros.fecha_hasta) params.fecha__lte = filtros.fecha_hasta;
    return params;
  }, [busqueda, filtros]);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = {
      ...buildBaseParams(),
      page: pagina, page_size: PAGE_SIZE,
      ordering: `${orden.dir === 'desc' ? '-' : ''}${orden.campo}`,
    };
    getAsistencias(params)
      .then(r => { setLista(r.data.results || []); setTotal(r.data.count || 0); })
      .catch(() => toast.error('No se pudieron cargar las asistencias'))
      .finally(() => setLoading(false));
  }, [pagina, orden, buildBaseParams]);

  const cargarGrafico = useCallback(() => {
    const params = {
      ...buildBaseParams(),
      page_size: 10000,
      ordering: '-fecha',
    };
    getAsistencias(params)
      .then(r => setDatosGraficoLista(r.data.results || []))
      .catch(() => setDatosGraficoLista([]));
  }, [buildBaseParams]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => { cargarGrafico(); }, [cargarGrafico]);

  useEffect(() => {
    getCongregaciones({ page_size: 1000 })
      .then(r => {
        const list = r.data.results || r.data || [];
        setCongregaciones(list);
        if (list.length && filtros.congregaciones.length === 0) {
          setFiltros(p => ({ ...p, congregaciones: [list[0].codigo] }));
          setPagina(1);
        }
      })
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
      online: a.online || 0,
      tema_predicacion: a.tema_predicacion || '',
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
        online: parseInt(form.online, 10) || 0,
        tema_predicacion: form.tema_predicacion,
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

  const cambiarOrden = (campo) => {
    setOrden(o => ({ campo, dir: o.campo === campo && o.dir === 'asc' ? 'desc' : 'asc' }));
    setPagina(1);
  };

  const iconoOrden = (campo) => {
    if (orden.campo !== campo) return <i className="bi bi-arrow-down-up text-muted opacity-50 ms-1 small"></i>;
    return <i className={`bi bi-arrow-${orden.dir === 'asc' ? 'up' : 'down'} ms-1 small`}></i>;
  };

  const COLORES = ['#198754', '#0d6efd', '#dc3545', '#fd7e14', '#6c757d'];
  const datosGraficoBase = useMemo(() => {
    const map = {};
    datosGraficoLista.forEach(a => {
      if (!map[a.congregacion]) {
        map[a.congregacion] = {
          congregacion: a.congregacion,
          nombre: nombreCongregacion(a.congregacion),
          creyentes: 0, simpatizantes: 0, visitas: 0, ninos: 0, online: 0, registros: 0,
        };
      }
      map[a.congregacion].creyentes += a.creyentes || 0;
      map[a.congregacion].simpatizantes += a.simpatizantes || 0;
      map[a.congregacion].visitas += a.visitas || 0;
      map[a.congregacion].ninos += a.ninos || 0;
      map[a.congregacion].online += a.online || 0;
      map[a.congregacion].registros += 1;
    });
    return Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [datosGraficoLista]);

  const datosGrafico = useMemo(() => {
    if (modoGrafico === 'totales') return datosGraficoBase;
    return datosGraficoBase.map(d => ({
      ...d,
      creyentes: d.registros ? Math.round(d.creyentes / d.registros) : 0,
      simpatizantes: d.registros ? Math.round(d.simpatizantes / d.registros) : 0,
      visitas: d.registros ? Math.round(d.visitas / d.registros) : 0,
      ninos: d.registros ? Math.round(d.ninos / d.registros) : 0,
      online: d.registros ? Math.round(d.online / d.registros) : 0,
    }));
  }, [datosGraficoBase, modoGrafico]);

  const datosCircular = useMemo(() => {
    const totalRegistros = datosGraficoBase.reduce((a, d) => a + d.registros, 0);
    const promedio = (campo) => totalRegistros ? Math.round(datosGraficoBase.reduce((a, d) => a + d[campo], 0) / totalRegistros) : 0;
    const total = (campo) => datosGraficoBase.reduce((a, d) => a + d[campo], 0);
    const valor = modoGrafico === 'promedios' ? promedio : total;
    return [
      { name: 'Creyentes', value: valor('creyentes'), color: COLORES[0] },
      { name: 'Simpatizantes', value: valor('simpatizantes'), color: COLORES[1] },
      { name: 'Visitas', value: valor('visitas'), color: COLORES[2] },
      { name: 'Niños', value: valor('ninos'), color: COLORES[3] },
      { name: 'OnLine', value: valor('online'), color: COLORES[4] },
    ].filter(d => d.value > 0);
  }, [datosGraficoBase, modoGrafico]);

  const renderGrafico = () => {
    if (datosGrafico.length === 0) return <p className="text-muted text-center py-5">No hay datos para graficar.</p>;
    if (tipoGrafico === 'circular') {
      return (
        <ResponsiveContainer width="100%" height={420}>
          <PieChart>
            <Pie data={datosCircular} dataKey="value" nameKey="name" outerRadius={140} label>
              {datosCircular.map((d, i) => <Cell key={`cell-${i}`} fill={d.color} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    if (tipoGrafico === 'lineas') {
      return (
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={datosGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nombre" tick={{ fontSize: 12 }} interval={0} angle={datosGrafico.length > 6 ? -30 : 0} textAnchor={datosGrafico.length > 6 ? 'end' : 'middle'} height={datosGrafico.length > 6 ? 70 : 30} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="creyentes" stroke={COLORES[0]} strokeWidth={2} />
            <Line type="monotone" dataKey="simpatizantes" stroke={COLORES[1]} strokeWidth={2} />
            <Line type="monotone" dataKey="visitas" stroke={COLORES[2]} strokeWidth={2} />
            <Line type="monotone" dataKey="ninos" stroke={COLORES[3]} strokeWidth={2} />
            <Line type="monotone" dataKey="online" stroke={COLORES[4]} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={datosGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="nombre" tick={{ fontSize: 12 }} interval={0} angle={datosGrafico.length > 6 ? -30 : 0} textAnchor={datosGrafico.length > 6 ? 'end' : 'middle'} height={datosGrafico.length > 6 ? 70 : 30} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="creyentes" stackId={tipoGrafico === 'barras_apiladas' ? 'a' : undefined} fill={COLORES[0]} />
          <Bar dataKey="simpatizantes" stackId={tipoGrafico === 'barras_apiladas' ? 'a' : undefined} fill={COLORES[1]} />
          <Bar dataKey="visitas" stackId={tipoGrafico === 'barras_apiladas' ? 'a' : undefined} fill={COLORES[2]} />
          <Bar dataKey="ninos" stackId={tipoGrafico === 'barras_apiladas' ? 'a' : undefined} fill={COLORES[3]} />
          <Bar dataKey="online" stackId={tipoGrafico === 'barras_apiladas' ? 'a' : undefined} fill={COLORES[4]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

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

        <div className="row g-3 mb-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Buscar</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input className="form-control" placeholder="Tema o congregación..."
                value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
              {busqueda && (
                <button className="btn btn-outline-secondary" onClick={() => { setBusqueda(''); setPagina(1); }}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Congregaciones</label>
            <MultiSelect
              options={congregaciones}
              value={filtros.congregaciones}
              onChange={v => { setFiltros(p => ({ ...p, congregaciones: v })); setPagina(1); }}
              getKey={c => c.codigo}
              getLabel={c => `${c.codigo} - ${c.nombre}`}
              placeholder="Todas las congregaciones" />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Desde</label>
            <input type="date" className="form-control form-control-sm"
              value={filtros.fecha_desde}
              onChange={e => { setFiltros(p => ({ ...p, fecha_desde: e.target.value })); setPagina(1); }} />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Hasta</label>
            <input type="date" className="form-control form-control-sm"
              value={filtros.fecha_hasta}
              onChange={e => { setFiltros(p => ({ ...p, fecha_hasta: e.target.value })); setPagina(1); }} />
          </div>
          <div className="col-md-auto">
            <button className="btn btn-sm btn-outline-primary" onClick={() => setModalGrafico(true)} disabled={datosGrafico.length === 0}>
              <i className="bi bi-bar-chart-line me-1"></i>Gráfico
            </button>
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
                    <tr style={{ fontSize: '0.75rem' }}>
                      <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', width: '1%' }} onClick={() => cambiarOrden('fecha')}>
                        Fecha {iconoOrden('fecha')}
                      </th>
                      <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', width: '1%' }} onClick={() => cambiarOrden('congregacion')}>
                        Congregación {iconoOrden('congregacion')}
                      </th>
                      <th className="text-end" style={{ width: '6%' }}>Creyentes</th>
                      <th className="text-end" style={{ width: '6%' }}>Simpatizantes</th>
                      <th className="text-end" style={{ width: '6%' }}>Visitas</th>
                      <th style={{ cursor: 'pointer', width: '7.2%' }} onClick={() => cambiarOrden('subtotal')}>
                        <div className="d-flex justify-content-end align-items-center">
                          Subtotal {iconoOrden('subtotal')}
                        </div>
                      </th>
                      <th className="text-end" style={{ width: '6%' }}>Niños</th>
                      <th className="text-end" style={{ width: '6%' }}>OnLine</th>
                      <th style={{ cursor: 'pointer', width: '7.2%' }} onClick={() => cambiarOrden('total')}>
                        <div className="d-flex justify-content-end align-items-center">
                          Total {iconoOrden('total')}
                        </div>
                      </th>
                      <th>Tema</th>
                      <th>Comentarios</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(a => (
                      <tr key={a.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <code className="me-1">{a.congregacion}</code>
                          <span className="small">{a.congregacion_nombre}</span>
                        </td>
                        <td className="text-end">{a.creyentes}</td>
                        <td className="text-end">{a.simpatizantes}</td>
                        <td className="text-end">{a.visitas}</td>
                        <td className="text-end fw-semibold">{a.subtotal}</td>
                        <td className="text-end">{a.ninos}</td>
                        <td className="text-end">{a.online}</td>
                        <td className="text-end fw-bold">{a.total}</td>
                        <td className="small">{a.tema_predicacion || '—'}</td>
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
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold">OnLine</label>
                      <input type="number" min="0" className="form-control"
                        value={form.online} onChange={e => setForm(f => ({ ...f, online: e.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Tema de predicación</label>
                      <input type="text" maxLength={50} className="form-control"
                        value={form.tema_predicacion} onChange={e => setForm(f => ({ ...f, tema_predicacion: e.target.value }))} />
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

      {modalGrafico && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={e => { if (e.target === e.currentTarget) setModalGrafico(false); }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title"><i className="bi bi-bar-chart-line me-2"></i>Gráfico de asistencias</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalGrafico(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3 mb-3">
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Tipo de gráfico</label>
                    <select className="form-select form-select-sm" value={tipoGrafico}
                      onChange={e => setTipoGrafico(e.target.value)}>
                      <option value="barras">Barras</option>
                      <option value="barras_apiladas">Barras apiladas</option>
                      <option value="lineas">Líneas</option>
                      <option value="circular">Circular</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Modo</label>
                    <select className="form-select form-select-sm" value={modoGrafico}
                      onChange={e => setModoGrafico(e.target.value)}>
                      <option value="totales">Totales</option>
                      <option value="promedios">Promedios</option>
                    </select>
                  </div>
                  <div className="col-md-6 d-flex align-items-end">
                    <small className="text-muted">
                      Congregaciones graficadas: <strong>{datosGrafico.length}</strong>
                      {modoGrafico === 'promedios' && <span className="ms-2">(promedio por registro)</span>}
                    </small>
                  </div>
                </div>
                {renderGrafico()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalGrafico(false)}>Cerrar</button>
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
