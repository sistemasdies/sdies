import { Fragment, useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import MultiSelect from '../../components/common/MultiSelect';
import { controlPresupuestal } from '../../api/presupuesto';
import { getCentrosCosto } from '../../api/centrosCosto';
import { formatMoney } from '../../utils/formato';
import toast from 'react-hot-toast';

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const COLORES = { presupuesto: '#0d6efd', real: '#dc3545' };
const TIPO_LABEL = { ingreso: 'Ingreso', gasto: 'Gasto', otro: 'Otro' };
const TIPO_ORDER = { ingreso: 0, gasto: 1, otro: 2 };

const tipoDe = cuenta => {
  const codigo = String(cuenta || '');
  if (codigo.startsWith('4')) return 'ingreso';
  if (codigo.startsWith('5')) return 'gasto';
  return 'otro';
};

export default function PresupuestoVsRealPage() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [modo, setModo] = useState('acumulado');
  const [nivel, setNivel] = useState('cuenta');
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [seleccionCC, setSeleccionCC] = useState([]);
  const [mostrarRegistrosEnCero, setMostrarRegistrosEnCero] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const itemsFiltrados = mostrarRegistrosEnCero
    ? (data?.items || [])
    : (data?.items || []).filter(d => parseFloat(d.real_a_comparar) !== 0 || parseFloat(d.presupuesto_a_comparar) !== 0);

  const num = v => parseFloat(v) || 0;

  const calcularTotales = items => {
    const presupuesto = items.reduce((s, d) => s + num(d.presupuesto_a_comparar), 0);
    const real = items.reduce((s, d) => s + num(d.real_a_comparar), 0);
    return {
      presupuestoMensual: items.reduce((s, d) => s + num(d.presupuesto_mensual), 0),
      presupuesto,
      real,
      variacion: items.reduce((s, d) => s + num(d.variacion), 0),
      porcentaje: presupuesto > 0 ? (real / presupuesto) * 100 : 0,
    };
  };

  // Agrupa por cuenta (con CC debajo) o por centro de costo (con cuentas debajo).
  // Ingresos (cuentas 4...) y gastos (cuentas 5...) nunca comparten renglón.
  const grupos = Object.values(itemsFiltrados.reduce((acc, d) => {
    const tipo = tipoDe(d.cuenta);
    const codigo = nivel === 'cuenta' ? d.cuenta : d.centro_costo;
    const clave = nivel === 'cuenta' ? codigo : `${codigo}|${tipo}`;
    const nombre = nivel === 'cuenta' ? d.cuenta_nombre : d.centro_costo_nombre;
    if (!acc[clave]) {
      acc[clave] = { clave, codigo, nombre, tipo, items: [] };
    }
    acc[clave].items.push(d);
    return acc;
  }, {})).map(g => ({ ...g, ...calcularTotales(g.items) }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo) || TIPO_ORDER[a.tipo] - TIPO_ORDER[b.tipo]);

  // Totales generales separados por tipo (aplica a ambos niveles y a ambos modos)
  const totalesPorTipo = ['ingreso', 'gasto'].map(tipo => ({
    tipo,
    ...calcularTotales(itemsFiltrados.filter(d => tipoDe(d.cuenta) === tipo)),
  }));

  const alertaGrupo = g => {
    if (g.porcentaje === 0) return num(g.variacion) < 0 ? 'rojo' : 'verde';
    if (g.tipo === 'ingreso') {
      if (g.porcentaje < 75) return 'rojo';
      if (g.porcentaje < 90) return 'naranja';
      return 'verde';
    }
    if (g.porcentaje > 100) return 'rojo';
    if (g.porcentaje > 90) return 'naranja';
    return 'verde';
  };

  useEffect(() => {
    getCentrosCosto({ page_size: 1000 })
      .then(r => {
        const lista = r.data.results || r.data || [];
        setCentrosCosto(lista.filter(c => c.is_active));
      })
      .catch(() => {});
  }, []);

  const consultar = useCallback(() => {
    setLoading(true);
    const params = { anio, mes, modo };
    if (seleccionCC.length) params.centros_costo = seleccionCC.join(',');
    controlPresupuestal(params)
      .then(r => setData(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Error al consultar control'))
      .finally(() => setLoading(false));
  }, [anio, mes, modo, seleccionCC]);

  useEffect(() => { consultar(); }, [consultar]);

  const datosGrafico = grupos
    .filter(g => g.presupuesto > 0 || g.real > 0)
    .map(g => ({
      name: `${g.codigo} ${g.nombre}${nivel === 'centro' ? ` (${TIPO_LABEL[g.tipo]})` : ''}`,
      presupuesto: g.presupuesto,
      real: g.real,
    }));

  return (
    <MainLayout>
      <TopBar title="Presupuesto vs Real" />
      <div className="p-4">
        <PageHeader title="Presupuesto vs Real" subtitle="Compare el presupuesto con la ejecución real">
          <div className="d-flex align-items-center gap-3">
            <div className="form-check mb-0">
              <input className="form-check-input" type="checkbox" id="chkCerosControl"
                checked={mostrarRegistrosEnCero}
                onChange={e => setMostrarRegistrosEnCero(e.target.checked)} />
              <label className="form-check-label small" htmlFor="chkCerosControl">Mostrar registros en cero</label>
            </div>
            <button className="btn btn-primary btn-sm" onClick={consultar}>
              <i className="bi bi-search me-2"></i>Consultar
            </button>
          </div>
        </PageHeader>

        <div className="row g-3 mb-3 align-items-end">
          <div className="col-md-1">
            <label className="form-label small fw-semibold">Año</label>
            <input type="number" className="form-control form-control-sm" value={anio} min="2000" max="2100"
              onChange={e => setAnio(parseInt(e.target.value, 10) || hoy.getFullYear())} />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Mes</label>
            <select className="form-select form-select-sm" value={mes} onChange={e => setMes(parseInt(e.target.value, 10))}>
              {MESES.map((m, i) => i > 0 && <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Modo</label>
            <select className="form-select form-select-sm" value={modo} onChange={e => setModo(e.target.value)}>
              <option value="mensual">Mensual</option>
              <option value="acumulado">Acumulado</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Nivel de visualización</label>
            <select className="form-select form-select-sm" value={nivel} onChange={e => setNivel(e.target.value)}>
              <option value="cuenta">Por Cuenta</option>
              <option value="centro">Por Centro de costo</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Centros de costo</label>
            <MultiSelect
              options={centrosCosto}
              value={seleccionCC}
              onChange={setSeleccionCC}
              getKey={c => c.codigo}
              getLabel={c => `${c.codigo} - ${c.descripcion}`}
              placeholder="Todos" />
          </div>
        </div>

        <div className="small text-muted mb-3">
          Alertas — Ingresos: rojo &lt; 75%, naranja &lt; 90%, verde ≥ 90% · Gastos: verde ≤ 90%, naranja &gt; 90%, rojo &gt; 100%
        </div>

        {loading ? <div className="py-5"><Spinner /></div>
          : !data || itemsFiltrados.length === 0 ? (
            <EmptyState icon="bi-graph-up" title="Sin datos" subtitle="No hay presupuesto o ejecución para los filtros seleccionados" />
          ) : (
            <>
              {datosGrafico.length > 0 && (
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={datosGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={datosGrafico.length > 8 ? -45 : 0} textAnchor={datosGrafico.length > 8 ? 'end' : 'middle'} height={datosGrafico.length > 8 ? 80 : 30} />
                      <YAxis />
                      <Tooltip formatter={v => formatMoney(v)} />
                      <Legend />
                      <Bar dataKey="presupuesto" name="Presupuesto" fill={COLORES.presupuesto} />
                      <Bar dataKey="real" name="Real" fill={COLORES.real} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle">
                  <thead className="table-dark">
                    <tr style={{ fontSize: '0.75rem' }}>
                      <th style={{ whiteSpace: 'nowrap', width: '1%' }}>{nivel === 'cuenta' ? 'Cuenta' : 'CC'}</th>
                      <th>Descripción</th>
                      <th style={{ whiteSpace: 'nowrap', width: '1%' }}>{nivel === 'cuenta' ? 'CC' : 'Cuenta'}</th>
                      <th className="text-end" style={{ width: '10%' }}>Presup. mensual</th>
                      <th className="text-end" style={{ width: '10%' }}>Factor</th>
                      <th className="text-end" style={{ width: '12%' }}>Presupuesto</th>
                      <th className="text-end" style={{ width: '12%' }}>Real</th>
                      <th className="text-end" style={{ width: '10%' }}>Variación</th>
                      <th className="text-end" style={{ width: '8%' }}>%</th>
                      <th className="text-center" style={{ width: '1%' }}>Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map(g => (
                      <Fragment key={g.clave}>
                        <tr className="table-light fw-semibold">
                          <td style={{ whiteSpace: 'nowrap' }}><code>{g.codigo}</code></td>
                          <td className="small" style={{ whiteSpace: 'nowrap' }}>
                            <span className={`badge ${g.tipo === 'ingreso' ? 'bg-primary' : 'bg-secondary'} me-2`}
                              style={{ fontSize: '0.65rem' }}>{TIPO_LABEL[g.tipo]}</span>
                            {g.nombre}
                          </td>
                          <td></td>
                          <td className="text-end">{formatMoney(g.presupuestoMensual)}</td>
                          <td className="text-end">{data?.factor_meses}</td>
                          <td className="text-end">{formatMoney(g.presupuesto)}</td>
                          <td className="text-end">{formatMoney(g.real)}</td>
                          <td className="text-end">{formatMoney(g.variacion)}</td>
                          <td className="text-end">{g.porcentaje.toFixed(2)}%</td>
                          <td className="text-center">{alertaBadge(alertaGrupo(g))}</td>
                        </tr>
                        {g.items.map((d, i) => (
                          <tr key={`${d.cuenta}-${d.centro_costo}-${i}`}>
                            <td></td>
                            <td className="small" style={{ whiteSpace: 'nowrap' }}>
                              {nivel === 'cuenta' ? d.centro_costo_nombre : d.cuenta_nombre}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }} className="small">
                              <code>{nivel === 'cuenta' ? d.centro_costo : d.cuenta}</code>
                            </td>
                            <td className="text-end">{formatMoney(d.presupuesto_mensual)}</td>
                            <td className="text-end">{d.factor_meses}</td>
                            <td className="text-end">{formatMoney(d.presupuesto_a_comparar)}</td>
                            <td className="text-end">{formatMoney(d.real_a_comparar)}</td>
                            <td className="text-end">{formatMoney(d.variacion)}</td>
                            <td className="text-end">{parseFloat(d.porcentaje_ejecucion).toFixed(2)}%</td>
                            <td className="text-center">{alertaBadge(d.alerta)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    {totalesPorTipo.map(t => (
                      <tr key={`total-${t.tipo}`} className="table-secondary fw-bold">
                        <td colSpan={3} className="text-end pe-3">
                          TOTAL {TIPO_LABEL[t.tipo].toUpperCase()} (cuentas {t.tipo === 'ingreso' ? '4' : '5'}...)
                        </td>
                        <td className="text-end">{formatMoney(t.presupuestoMensual)}</td>
                        <td className="text-end">{data?.factor_meses}</td>
                        <td className="text-end">{formatMoney(t.presupuesto)}</td>
                        <td className="text-end">{formatMoney(t.real)}</td>
                        <td className="text-end">{formatMoney(t.variacion)}</td>
                        <td className="text-end">{t.porcentaje.toFixed(2)}%</td>
                        <td className="text-center">{alertaBadge(alertaGrupo(t))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="small text-muted mt-2">
                {itemsFiltrados.length} registro(s) mostrado(s) de {data?.items?.length || 0}
              </div>
            </>
          )}
      </div>
    </MainLayout>
  );
}

function alertaBadge(alerta) {
  const map = {
    rojo: { color: 'bg-danger', icon: 'bi-exclamation-triangle' },
    naranja: { color: 'bg-warning', icon: 'bi-exclamation-circle', style: { backgroundColor: '#fd7e14', color: '#fff' } },
    amarillo: { color: 'bg-warning', icon: 'bi-exclamation-circle' },
    verde: { color: 'bg-success', icon: 'bi-check-circle' },
  };
  const conf = map[alerta] || map.verde;
  return <span className={`badge ${conf.color}`} style={conf.style} title={alerta}>
    <i className={`bi ${conf.icon}`}></i>
  </span>;
}
