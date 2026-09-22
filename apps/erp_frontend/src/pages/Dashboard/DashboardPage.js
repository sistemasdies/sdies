import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import Spinner from '../../components/common/Spinner';
import { getBalanceGeneral, getEstadoResultados } from '../../api/reportes';
import { getPeriodos } from '../../api/periodos';
import { getAsientos } from '../../api/asientos';
import { formatMoney } from '../../utils/formato';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

export default function DashboardPage() {
  const [balance,   setBalance]   = useState(null);
  const [resultado, setResultado] = useState(null);
  const [periodos,  setPeriodos]  = useState([]);
  const [asientos,  setAsientos]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const hoy   = new Date().toISOString().split('T')[0];
    const anio  = new Date().getFullYear();
    Promise.allSettled([
      getBalanceGeneral({ fecha_hasta: hoy }),
      getEstadoResultados({ fecha_desde: `${anio}-01-01`, fecha_hasta: hoy }),
      getPeriodos(),
      getAsientos({ page_size: 5 }),
    ]).then(([b, r, p, a]) => {
      if (b.status === 'fulfilled') setBalance(b.value.data);
      if (r.status === 'fulfilled') setResultado(r.value.data);
      if (p.status === 'fulfilled') setPeriodos(p.value.data.results || p.value.data);
      if (a.status === 'fulfilled') setAsientos(a.value.data.results || []);
    }).finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: 'Total Activos',   value: balance?.total_activos,  icon: 'bi-bank',          color: 'success' },
    { label: 'Total Pasivos',   value: balance?.total_pasivos,  icon: 'bi-credit-card',   color: 'danger'  },
    { label: 'Patrimonio',      value: balance?.patrimonio,      icon: 'bi-shield-check',  color: 'primary' },
    { label: 'Utilidad del Año',value: resultado?.utilidad,      icon: 'bi-graph-up-arrow',color: resultado?.utilidad >= 0 ? 'success' : 'danger' },
  ];

  const chartData = [
    { name: 'Ingresos', valor: parseFloat(resultado?.ingresos || 0) },
    { name: 'Gastos',   valor: parseFloat(resultado?.gastos   || 0) },
    { name: 'Utilidad', valor: parseFloat(resultado?.utilidad || 0) },
  ];

  const periodosAbiertos = periodos.filter(p => p.estado === 'A').length;

  if (loading) return (
    <MainLayout><TopBar title="Dashboard" /><div className="p-4"><Spinner /></div></MainLayout>
  );

  return (
    <MainLayout>
      <TopBar title="Dashboard" />
      <div className="p-4">

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {kpis.map(({ label, value, icon, color }) => (
            <div key={label} className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-muted small fw-semibold">{label}</span>
                    <i className={`bi ${icon} fs-4 text-${color}`}></i>
                  </div>
                  <div className={`fs-5 fw-bold text-${color}`}>
                    {formatMoney(value)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="row g-3">
          {/* Gráfico */}
          <div className="col-md-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-0 fw-semibold">
                <i className="bi bi-bar-chart me-2 text-success"></i>
                Resumen del año
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} />
                    <Tooltip formatter={v => formatMoney(v)} />
                    <Bar dataKey="valor" fill="#198754" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Estado períodos */}
          <div className="col-md-5">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 fw-semibold">
                <i className="bi bi-calendar3 me-2 text-success"></i>
                Períodos contables
              </div>
              <div className="card-body p-0">
                <div className="list-group list-group-flush">
                  {periodos.slice(0,6).map(p => (
                    <div key={p.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
                      <span className="small">{p.nombre}</span>
                      <span className={`badge bg-${p.estado === 'A' ? 'success' : p.estado === 'C' ? 'warning' : 'secondary'}`}>
                        {p.estado_display}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-footer bg-white border-0 small text-muted">
                {periodosAbiertos} período(s) abierto(s)
              </div>
            </div>
          </div>

          {/* Últimos asientos */}
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-0 fw-semibold">
                <i className="bi bi-journal-text me-2 text-success"></i>
                Últimos asientos
              </div>
              <div className="table-responsive">
                <table className="table table-hover table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Referencia</th>
                      <th>Fecha</th>
                      <th className="text-center">Nº líneas</th>
                      <th className="text-end">Débitos</th>
                      <th className="text-end">Créditos</th>
                      <th className="text-end">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asientos.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted py-3">Sin asientos</td></tr>
                    )}
                    {asientos.map(a => {
                      const dif = Math.abs((parseFloat(a.total_debitos)||0) - (parseFloat(a.total_creditos)||0));
                      const descuadrado = dif >= 0.01;
                      return (
                      <tr key={`${a.cod_comprob}-${a.num_comprob}`}
                          className={descuadrado ? 'table-danger fw-bold' : ''}>
                        <td><code className="small">{a.referencia}</code></td>
                        <td className="small">{a.fecha}</td>
                        <td className="text-center small">{a.num_lineas}</td>
                        <td className="text-end small">{formatMoney(a.total_debitos)}</td>
                        <td className="text-end small">{formatMoney(a.total_creditos)}</td>
                        <td className="text-end small">
                          {descuadrado ? (
                            <span className="text-danger fw-bold">
                              <i className="bi bi-exclamation-triangle-fill me-1"></i>
                              {formatMoney(dif)}
                            </span>
                          ) : (
                            <span className="text-success">
                              <i className="bi bi-check-circle-fill me-1"></i>
                              {formatMoney(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
