import { useEffect, useState, useCallback } from 'react';
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

export default function ControlPresupuestalPage() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [modo, setModo] = useState('acumulado');
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [seleccionCC, setSeleccionCC] = useState([]);
  const [topeAlto, setTopeAlto] = useState(110);
  const [topeBajo, setTopeBajo] = useState(90);
  const [mostrarRegistrosEnCero, setMostrarRegistrosEnCero] = useState(true);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const itemsFiltrados = mostrarRegistrosEnCero
    ? (data?.items || [])
    : (data?.items || []).filter(d => parseFloat(d.real_a_comparar) !== 0 || parseFloat(d.presupuesto_a_comparar) !== 0);

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
    const params = {
      anio, mes, modo,
      tope_alto: topeAlto,
      tope_bajo: topeBajo,
    };
    if (seleccionCC.length) params.centros_costo = seleccionCC.join(',');
    controlPresupuestal(params)
      .then(r => setData(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Error al consultar control'))
      .finally(() => setLoading(false));
  }, [anio, mes, modo, seleccionCC, topeAlto, topeBajo]);

  useEffect(() => { consultar(); }, [consultar]);

  const datosGrafico = itemsFiltrados
    .filter(d => d.real_a_comparar > 0 || d.presupuesto_a_comparar > 0)
    .map(d => ({
      name: `${d.cuenta} ${d.centro_costo}`,
      presupuesto: parseFloat(d.presupuesto_a_comparar),
      real: parseFloat(d.real_a_comparar),
    }));

  return (
    <MainLayout>
      <TopBar title="Control Presupuestal" />
      <div className="p-4">
        <PageHeader title="Control Presupuestal" subtitle="Compare el presupuesto con la ejecución real">
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
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Centros de costo</label>
            <MultiSelect
              options={centrosCosto}
              value={seleccionCC}
              onChange={setSeleccionCC}
              getKey={c => c.codigo}
              getLabel={c => `${c.codigo} - ${c.descripcion}`}
              placeholder="Todos" />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Tope alto %</label>
            <input type="number" className="form-control form-control-sm" value={topeAlto}
              onChange={e => setTopeAlto(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Tope bajo %</label>
            <input type="number" className="form-control form-control-sm" value={topeBajo}
              onChange={e => setTopeBajo(e.target.value)} />
          </div>
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
                      <th style={{ whiteSpace: 'nowrap', width: '1%' }}>Cuenta</th>
                      <th>Descripción</th>
                      <th style={{ whiteSpace: 'nowrap', width: '1%' }}>CC</th>
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
                    {itemsFiltrados.map((d, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}><code>{d.cuenta}</code></td>
                        <td className="small">{d.cuenta_nombre}</td>
                        <td style={{ whiteSpace: 'nowrap' }} className="small">{d.centro_costo}</td>
                        <td className="text-end">{formatMoney(d.presupuesto_mensual)}</td>
                        <td className="text-end">{d.factor_meses}</td>
                        <td className="text-end">{formatMoney(d.presupuesto_a_comparar)}</td>
                        <td className="text-end">{formatMoney(d.real_a_comparar)}</td>
                        <td className="text-end">{formatMoney(d.variacion)}</td>
                        <td className="text-end">{parseFloat(d.porcentaje_ejecucion).toFixed(2)}%</td>
                        <td className="text-center">{alertaBadge(d.alerta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
    amarillo: { color: 'bg-warning', icon: 'bi-exclamation-circle' },
    verde: { color: 'bg-success', icon: 'bi-check-circle' },
  };
  const conf = map[alerta] || map.verde;
  return <span className={`badge ${conf.color}`}><i className={`bi ${conf.icon}`}></i></span>;
}
