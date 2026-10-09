import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import MultiSelect from '../../components/common/MultiSelect';
import { getComparativoMeses } from '../../api/reportes';
import { getComprobantes } from '../../api/comprobantes';
import { getCuentas } from '../../api/cuentas';
import { getCentrosCosto } from '../../api/centrosCosto';
import { getTerceros } from '../../api/terceros';
import { formatMoney } from '../../utils/formato';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { usePreferencias } from '../../hooks/usePreferencias';

const money = (v) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = parseFloat(v);
  if (Number.isNaN(n)) return '';
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(n);
};
const celda = (v) => (parseFloat(v || 0) === 0 ? '' : money(v));

const hoy = new Date();
const MES_ACTUAL = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
const ANIO_ACTUAL = String(hoy.getFullYear());

const FLT = {
  agrupacion: 'mes', inicio: MES_ACTUAL, cuenta: [], centro_costo: [],
  comprobante: [], tercero: [], detalle_terceros: 'no',
};

const SiNo = ({ value, onChange, offLabel = 'No', onLabel = 'Sí' }) => (
  <div className="btn-group btn-group-sm w-100">
    <button type="button"
      className={`btn btn-sm ${value === 'si' ? 'btn-outline-secondary' : 'btn-success'}`}
      onClick={() => onChange('no')}>{offLabel}</button>
    <button type="button"
      className={`btn btn-sm ${value === 'si' ? 'btn-success' : 'btn-outline-secondary'}`}
      onClick={() => onChange('si')}>{onLabel}</button>
  </div>
);const STICKY = { position: 'sticky', backgroundColor:'#343a40', color:'#fff', zIndex:2 };
const STICKY2 = { position: 'sticky', backgroundColor:'#343a40', color:'#fff', zIndex:3 };
const COL_COD = { position:'sticky', left:0,   zIndex:1, backgroundColor:'#fff' };
const COL_DESC= { position:'sticky', left:96,  zIndex:1, backgroundColor:'#fff' };
const COL_COD_HEAD = { ...STICKY, left:0,  zIndex:3 };
const COL_DESC_HEAD= { ...STICKY, left:96, zIndex:3 };

const NEG = '#ffb3b3';

// Renglón de subtotal dentro del cuerpo (TOTAL INGRESOS / TOTAL GASTOS).
const FilaSubtotal = ({ etiqueta, valores = [], total }) => (
  <tr className="table-light fw-bold">
    <td style={{ ...COL_COD, backgroundColor:'#eef1f5' }}></td>
    <td style={{ ...COL_DESC, backgroundColor:'#eef1f5' }}>{etiqueta}</td>
    {valores.map((v, j) => (
      <td key={j} className="text-end fw-bold"
        style={parseFloat(v || 0) < 0 ? { color:'#b02a37' } : undefined}>
        {celda(v)}
      </td>
    ))}
    <td className="text-end fw-bold"
      style={parseFloat(total || 0) < 0 ? { color:'#b02a37' } : undefined}>
      {money(total)}
    </td>
  </tr>
);

// Renglón del pie: etiqueta a la izquierda, 12 meses y el total del período.
const FilaPie = ({ etiqueta, valores = [], total, destacado }) => (
  <tr style={destacado ? { backgroundColor:'#16191d' } : undefined}>
    <td style={{ ...COL_COD, backgroundColor:'#343a40' }}></td>
    <td style={{ ...COL_DESC, backgroundColor:'#343a40', color:'#fff' }}
      className={destacado ? 'fw-bold' : 'fw-semibold'}>
      {etiqueta}
    </td>
    {valores.map((v, j) => (
      <td key={j} className={`text-end ${destacado ? 'fw-bold' : 'fw-semibold'}`}
        style={parseFloat(v || 0) < 0 ? { color: NEG } : undefined}>
        {celda(v)}
      </td>
    ))}
    <td className={`text-end ${destacado ? 'fw-bold' : 'fw-semibold'}`}
      style={parseFloat(total || 0) < 0 ? { color: NEG } : undefined}>
      {money(total)}
    </td>
  </tr>
);

export default function ComparativoMesesPage() {
  const { data: prefs, guardar: guardarPrefs, estaListo: prefsListo } = usePreferencias();
  const [filtros, setFiltros] = useState(() => ({ ...FLT }));
  const [opciones, setOpciones] = useState({ comprobantes:[], cuentas:[], centros:[], terceros:[] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getComprobantes().then(r => setOpciones(o => ({ ...o, comprobantes: r.data.results || r.data }))).catch(()=>{});
    getCuentas({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, cuentas: r.data.results || r.data }))).catch(()=>{});
    getCentrosCosto().then(r => setOpciones(o => ({ ...o, centros: r.data.results || r.data }))).catch(()=>{});
    getTerceros({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, terceros: r.data.results || r.data }))).catch(()=>{});
  }, []);

  // Rehidratar filtros guardados
  useEffect(() => {
    if (!prefsListo || !prefs) return;
    const g = prefs['comparativo_meses'];
    if (g) {
      setFiltros(f => ({
        ...FLT,
        agrupacion:       g.agrupacion       ?? f.agrupacion,
        inicio:           g.inicio           ?? f.inicio,
        cuenta:           g.cuenta           ?? f.cuenta,
        centro_costo:     g.centro_costo     ?? f.centro_costo,
        comprobante:      g.comprobante      ?? f.comprobante,
        tercero:          g.tercero          ?? f.tercero,
        detalle_terceros: g.detalle_terceros ?? f.detalle_terceros,
      }));
    }
  }, [prefsListo]);

  // Persistir con debounce
  useEffect(() => {
    if (!guardarPrefs) return;
    const t = setTimeout(() => guardarPrefs({ 'comparativo_meses': filtros }), 600);
    return () => clearTimeout(t);
  }, [filtros]);

  const buscar = () => {
    setLoading(true);
    const params = {
      inicio: filtros.inicio || undefined,
      agrupacion: filtros.agrupacion,
      cuenta:            filtros.cuenta.length             ? filtros.cuenta.join(',')             : undefined,
      centro_costo:      filtros.centro_costo.length       ? filtros.centro_costo.join(',')       : undefined,
      comprobante:       filtros.comprobante.length        ? filtros.comprobante.join(',')        : undefined,
      cedula:            filtros.tercero.length            ? filtros.tercero.join(',')            : undefined,
      detalle_terceros:  filtros.detalle_terceros,
    };
    Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
    getComparativoMeses(params)
      .then(r => setData(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Error al consultar'))
      .finally(() => setLoading(false));
  };

  // Cambiar de agrupación reinicia el periodo inicial al formato correspondiente.
  const cambiarAgrupacion = (v) => {
    setFiltros(f => ({
      ...f, agrupacion: v,
      inicio: v === 'anio' ? ANIO_ACTUAL : MES_ACTUAL,
    }));
    setData(null);
  };

  const limpiar = () => {
    setFiltros({ ...FLT });
    setData(null);
  };

  const porAnios = filtros.agrupacion === 'anio';
  const etiquetas = data?.etiquetas || [];
  const subetiquetas = data?.subetiquetas || [];
  const etiquetaTotal = data?.etiqueta_total_periodo || 'Total 12 meses';

  // Renglones aplanados: cuenta y sus terceros debajo; los subtotales de
  // ingresos y gastos se intercalan justo después de su último renglón.
  const filas = data?.filas || [];
  const ultimo = (clase) => filas.reduce((acc, f, i) => (f.clase === clase ? i : acc), -1);
  const finIngresos = ultimo('4');
  const finGastos = ultimo('5');

  const renglones = [];
  filas.forEach((f, i) => {
    renglones.push({ ...f, esTercero: false });
    (f.terceros || []).forEach(t => renglones.push({ ...t, esTercero: true }));
    if (i === finIngresos) renglones.push({
      esSubtotal: true, etiqueta: 'TOTAL INGRESOS',
      valores: data.total_ingresos, total: data.total_ingresos_periodo,
    });
    if (i === finGastos) renglones.push({
      esSubtotal: true, etiqueta: 'TOTAL GASTOS',
      valores: data.total_gastos, total: data.total_gastos_periodo,
    });
  });

  // Solo se muestra "Otras cuentas" si el filtro incluye clases distintas de 4 y 5.
  const hayOtros = filas.some(f => f.clase !== '4' && f.clase !== '5');

  // Datos del gráfico: el renglón Superávit / Déficit mes a mes.
  const chartData = (data?.superavit || []).map((v, i) => ({
    mes: subetiquetas[i] ? `${etiquetas[i]} ${subetiquetas[i].slice(-2)}` : etiquetas[i],
    valor: parseFloat(v || 0),
  }));
  const hayGrafico = chartData.some(d => d.valor !== 0);

  return (
    <MainLayout>
      <TopBar title="Saldos Meses/Años" />
      <div className="p-4">
        <PageHeader title="Saldos Meses/Años"
          subtitle={data
            ? `${filas.length} cuenta(s) · ${etiquetas.length} columnas · ${data.fecha_desde} a ${data.fecha_hasta} · Superávit/Déficit 12 ${porAnios ? 'años' : 'meses'}: ${money(data.superavit_periodo)}`
            : 'Acumulado de los 12 meses (o 12 años) que arrancan en el periodo indicado'}>
        </PageHeader>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end mb-2">
              <div className="col-md-3">
                <label className="form-label small mb-1">Agrupar por</label>
                <div className="btn-group w-100" role="group">
                  <button type="button"
                    className={`btn btn-sm ${porAnios ? 'btn-outline-secondary' : 'btn-success'}`}
                    onClick={() => cambiarAgrupacion('mes')}>
                    <i className="bi bi-calendar3 me-1"></i>Meses
                  </button>
                  <button type="button"
                    className={`btn btn-sm ${porAnios ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => cambiarAgrupacion('anio')}>
                    <i className="bi bi-calendar-range me-1"></i>Años
                  </button>
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">{porAnios ? 'Año inicial' : 'Mes inicial'}</label>
                <input type={porAnios ? 'number' : 'month'} className="form-control form-control-sm"
                  value={filtros.inicio} min={porAnios ? 1900 : undefined} max={porAnios ? 2999 : undefined}
                  step={porAnios ? 1 : undefined}
                  onChange={e => setFiltros(f => ({ ...f, inicio: e.target.value }))} />
                <small className="text-muted">
                  {porAnios ? 'Cubre 12 años hacia adelante' : 'Cubre 12 meses hacia adelante'}
                </small>
              </div>
              <div className="col-md-4">
                <label className="form-label small mb-1">Cuentas (clase 4 y 5 si no elige)</label>
                <MultiSelect options={opciones.cuentas} value={filtros.cuenta}
                  getKey={c => c.codigo} getLabel={c => `${c.codigo} — ${c.descripcion}`}
                  onChange={v => setFiltros(f => ({ ...f, cuenta: v }))}
                  placeholder="Todas las de Ingreso y Gasto" />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">Centro de costo</label>
                <MultiSelect options={opciones.centros} value={filtros.centro_costo}
                  getKey={cc => cc.codigo} getLabel={cc => `${cc.codigo} — ${cc.descripcion}`}
                  onChange={v => setFiltros(f => ({ ...f, centro_costo: v }))} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">Comprobante</label>
                <MultiSelect options={opciones.comprobantes} value={filtros.comprobante}
                  getKey={c => c.codigo} getLabel={c => `${c.codigo} — ${c.descripcion || ''}`}
                  onChange={v => setFiltros(f => ({ ...f, comprobante: v }))} />
              </div>
            </div>

            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label small mb-1">Terceros</label>
                <MultiSelect options={opciones.terceros} value={filtros.tercero}
                  getKey={t => t.cedula} getLabel={t => `${t.cedula} — ${t.nombre_completo}`}
                  onChange={v => setFiltros(f => ({ ...f, tercero: v }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Detalle de terceros</label>
                <SiNo value={filtros.detalle_terceros}
                  onChange={v => setFiltros(f => ({ ...f, detalle_terceros: v }))} />
              </div>
              <div className="col-md-6 d-flex gap-2 align-items-end">
                <button className="btn btn-primary btn-sm px-3" onClick={buscar}>
                  <i className="bi bi-search me-1"></i>Generar
                </button>
                <button className="btn btn-outline-danger btn-sm" onClick={limpiar}>
                  <i className="bi bi-x-circle me-1"></i>Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="card border-0 shadow-sm">
          {loading ? <div className="p-4"><Spinner /></div> : !data ? (
            <div className="card-body text-center text-muted py-5">
              <i className="bi bi-search display-5 d-block mb-2 text-secondary"></i>
              Aplique los filtros y presione <strong>Generar</strong> para ver el informe.
            </div>
          ) : renglones.length === 0 ? (
            <div className="card-body text-center text-muted py-5">
              <i className="bi bi-inbox display-5 d-block mb-2 text-secondary"></i>
              Sin movimientos para los filtros seleccionados.
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight:'65vh', overflowY:'auto' }}>
              <table className="table table-sm table-bordered align-middle mb-0">
                <thead className="table-dark">
                  <tr>
                    <th style={{ ...COL_COD_HEAD, minWidth:96 }}>Código</th>
                    <th style={{ ...COL_DESC_HEAD, minWidth:240 }}>Descripción</th>
                    {etiquetas.map((m, i) => (
                      <th key={i} className="text-end" style={{ ...STICKY, minWidth:110 }}>
                        {m}
                        {subetiquetas[i] && (
                          <div style={{ fontSize:'0.68rem', fontWeight:400, opacity:0.75 }}>
                            {subetiquetas[i]}
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="text-end" style={{ ...STICKY, minWidth:120 }}>
                      {etiquetaTotal}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((r, i) => {
                    if (r.esSubtotal) {
                      return <FilaSubtotal key={`sub-${i}`} etiqueta={r.etiqueta}
                        valores={r.valores} total={r.total} />;
                    }
                    const esTercero = r.esTercero;
                    const bgCelda = esTercero ? '#fafbff' : '#fff';
                    const neg = (v) => parseFloat(v || 0) < 0;
                    return (
                      <tr key={`${r.tipo}-${r.codigo}-${i}`}
                        className={esTercero ? '' : 'fw-semibold'}
                        style={{ fontStyle: esTercero ? 'italic' : 'normal',
                                 backgroundColor: esTercero ? '#fafbff' : undefined }}>
                        <td style={{ ...COL_COD, backgroundColor: bgCelda }}>
                          {esTercero
                            ? <span className="small ps-3 text-muted">{r.cedula || 'SIN'}</span>
                            : <code className="small">{r.codigo}</code>}
                        </td>
                        <td style={{ ...COL_DESC, backgroundColor: bgCelda,
                                      paddingLeft: esTercero ? 32 : 8 }}>
                          <span className="small">{r.descripcion}</span>
                        </td>
                        {(r.valores || []).map((v, j) => (
                          <td key={j} className={`text-end ${esTercero ? 'small' : ''} ${neg(v) ? 'text-danger fw-bold' : ''}`}>
                            {celda(v)}
                          </td>
                        ))}
                        <td className={`text-end ${neg(r.total) ? 'text-danger fw-bold' : 'fw-bold'}`}>
                          {money(r.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="table-dark">
                  {hayOtros && (
                    <FilaPie etiqueta="OTRAS CUENTAS"
                      valores={data.total_otros} total={data.total_otros_periodo} />
                  )}
                  <FilaPie etiqueta="SUPERÁVIT / DÉFICIT" destacado
                    valores={data.superavit} total={data.superavit_periodo} />
                </tfoot>
              </table>
              {filtros.detalle_terceros === 'si' && (
                <div className="card-footer bg-white small text-muted py-1">
                  Los renglones en cursiva son terceros y suman al renglón de su cuenta.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gráfico del renglón Superávit / Déficit */}
        {data && hayGrafico && (
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-header bg-white border-0 fw-semibold">
              <i className="bi bi-bar-chart me-2 text-success"></i>
              Superávit / Déficit por mes
              <span className="fw-normal small text-muted ms-2">
                Total {porAnios ? '12 años' : '12 meses'}:{' '}
                <strong className={parseFloat(data.superavit_periodo) < 0 ? 'text-danger' : 'text-success'}>
                  {money(data.superavit_periodo)}
                </strong>
              </span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top:5, right:20, bottom:5, left:10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => formatMoney(v).replace(/COP\s?/, '$ ')} width={120} />
                  <Tooltip formatter={v => formatMoney(v)} cursor={{ fill:'rgba(0,0,0,0.05)' }} />
                  <ReferenceLine y={0} stroke="#6c757d" />
                  <Bar dataKey="valor" radius={[4,4,0,0]} maxBarSize={48}>
                    {chartData.map((d, i) => (
                      <Cell key={i}
                        fill={d.valor < 0 ? '#dc3545' : '#198754'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}