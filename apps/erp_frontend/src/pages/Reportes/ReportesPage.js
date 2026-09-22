import { useState, useEffect } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import MultiSelect from '../../components/common/MultiSelect';
import { getBalanceGeneral, getEstadoResultados, getBalanceComprobacion } from '../../api/reportes';
import { getComprobantes } from '../../api/comprobantes';
import { getCuentas } from '../../api/cuentas';
import { getCentrosCosto } from '../../api/centrosCosto';
import { formatMoney } from '../../utils/formato';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import { usePerm } from '../../hooks/usePerm';
import { usePreferencias } from '../../hooks/usePreferencias';

const CLASE_BG = { A:'rgba(25,135,84,0.2)', P:'rgba(220,53,69,0.2)', T:'rgba(13,110,253,0.2)', I:'rgba(253,126,20,0.2)', G:'rgba(108,117,125,0.2)' };

const NIVELES = [
  { valor:'1', label:'1 Principal' },
  { valor:'2', label:'2 General' },
  { valor:'3', label:'3 Mayor' },
  { valor:'4', label:'4 Detalle' },
  { valor:'5', label:'5 Centro de Costos' },
  { valor:'6', label:'6 Cédula' },
];

const NIVEL_ESTILO = {
  '1': { bg: '#343a40', color: '#ffffff', bold: true },
  '2': { bg: '#f1f3f7', color: '#000000' },
  '3': { color: '#495057' },
  '4': { color: '#212529' },
  '5': { bg: '#eef6ff', color: '#2c6fbb' },
  '6': { bg: '#fafbff', color: '#6c757d' },
};

export default function ReportesPage() {
  const { canAdd } = usePerm('/reportes');
  const { data, guardar, estaListo } = usePreferencias();
  const hoy = new Date().toISOString().split('T')[0];
  const [tipo,    setTipo]    = useState('balance_general');
  const [desde,   setDesde]   = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta,   setHasta]   = useState(hoy);
  const [niveles, setNiveles] = useState(NIVELES.map(n => n.valor));
  const [libro,   setLibro]   = useState([]);
  const [cuenta,  setCuenta]  = useState([]);
  const [centro,  setCentro]  = useState([]);
  const [mostrarCeros, setMostrarCeros] = useState(false);
  const [opciones, setOpciones] = useState({ comprobantes:[], cuentas:[], centros:[] });
  const [dataR,   setDataR]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getComprobantes().then(r => setOpciones(o => ({ ...o, comprobantes:r.data.results || r.data }))).catch(()=>{});
    getCuentas({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, cuentas:r.data.results || r.data }))).catch(()=>{});
    getCentrosCosto().then(r => setOpciones(o => ({ ...o, centros:r.data.results || r.data }))).catch(()=>{});
  }, []);

  // Rehidratar desde preferencias una vez cargadas
  useEffect(() => {
    if (!estaListo || !data) return;
    const p = data['reportes'] || {};
    if (p.tipo)            setTipo(p.tipo);
    if (p.desde && p.desde !== '') setDesde(p.desde);
    if (p.hasta && p.hasta !== '') setHasta(p.hasta);
    if (p.nivel)  {
      const arr = Array.isArray(p.nivel) ? p.nivel : String(p.nivel).split(',');
      const validos = arr.map(x => String(x).trim()).filter(x => NIVELES.some(n => n.valor === x));
      if (validos.length) setNiveles(validos);
    }
    if (Array.isArray(p.libro))  setLibro(p.libro);
    if (Array.isArray(p.cuenta)) setCuenta(p.cuenta);
    if (Array.isArray(p.centro)) setCentro(p.centro);
    if (typeof p.mostrar_ceros === 'boolean') setMostrarCeros(p.mostrar_ceros);
  }, [estaListo]);

  // Guardar en preferencias cada vez que cambian los filtros
  const persistir = (obj) => guardar({ 'reportes': { ...(data?.['reportes']||{}), ...obj } });

  const generar = async () => {
    setLoading(true);
    try {
      let res;
      if      (tipo === 'balance_general')      res = await getBalanceGeneral({ fecha_hasta: hasta });
      else if (tipo === 'estado_resultados')    res = await getEstadoResultados({ fecha_desde: desde, fecha_hasta: hasta });
      else                                      res = await getBalanceComprobacion({
        fecha_desde: desde, fecha_hasta: hasta,
        nivel: niveles.length ? `${Math.max(...niveles.map(Number))}` : '6',
        libro:  libro.length  ? libro.join(',')  : undefined,
        cuenta: cuenta.length ? cuenta.join(',') : undefined,
        centro: centro.length ? centro.join(',') : undefined,
      });
      setDataR(res.data);
    } catch { toast.error('Error al generar reporte'); }
    finally { setLoading(false); }
  };

  const onTipo  = (v) => { setTipo(v); setDataR(null); persistir({ tipo: v }); };
  const onDesde = (v) => { setDesde(v); setDataR(null); persistir({ desde: v }); };
  const onHasta = (v) => { setHasta(v); setDataR(null); persistir({ hasta: v }); };
  const toggleNivel = (v) => {
    setNiveles(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
    setDataR(null); persistir({ nivel: (niveles.includes(v) ? niveles.filter(x => x !== v) : [...niveles, v]) });
  };
  const setTodosNiveles = () => { setNiveles(NIVELES.map(n => n.valor)); setDataR(null); persistir({ nivel: NIVELES.map(n => n.valor) }); };
  const onLibro = (v) => { setLibro(v); setDataR(null); persistir({ libro: v }); };
  const onCuenta= (v) => { setCuenta(v); setDataR(null); persistir({ cuenta: v }); };
  const onCentro= (v) => { setCentro(v); setDataR(null); persistir({ centro: v }); };
  const onCeros = (v) => { setMostrarCeros(v); persistir({ mostrar_ceros: v }); };

  const filaEsCero = (r) => !r.anterior && !r.debitos && !r.creditos && !r.saldo;
  const filaVisible = (r) => (niveles.length === 0 || niveles.includes(r.nivel)) && (mostrarCeros || !filaEsCero(r));
  const tamanioNivel = (n) => `${[16, 14.5, 14, 13.5, 13, 12.5][Math.min(5, Math.max(0, (parseInt(n, 10) || 1) - 1))]}px`;

  return (
    <MainLayout>
      <TopBar title="Reportes Financieros" />
      <div className="p-4">
        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Tipo de reporte</label>
                <select className="form-select" value={tipo}
                  onChange={e => onTipo(e.target.value)}>
                  <option value="balance_general">Balance General</option>
                  <option value="estado_resultados">Estado de Resultados (P&G)</option>
                  <option value="balance_comprobacion">Balance de Comprobación</option>
                </select>
              </div>
              {tipo !== 'balance_general' && (
                <div className="col-md-2">
                  <label className="form-label small fw-semibold">Desde</label>
                  <input type="date" className="form-control" value={desde}
                    onChange={e => onDesde(e.target.value)} />
                </div>
              )}
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Hasta</label>
                <input type="date" className="form-control" value={hasta}
                  onChange={e => onHasta(e.target.value)} />
              </div>
              <div className="col-md-2">
                <button className="btn btn-success w-100" onClick={generar} disabled={loading || !canAdd}>
                  <i className="bi bi-play-fill me-1"></i>Generar
                </button>
              </div>
            </div>

            {tipo === 'balance_comprobacion' && (
              <>
                <hr className="my-3" />
                <div className="row g-3 align-items-end">
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Niveles a mostrar</label>
                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      {NIVELES.map(n => (
                        <div key={n.valor} className="form-check form-check-inline mb-0">
                          <input className="form-check-input" type="checkbox"
                            value={n.valor} id={`nivel-${n.valor}`}
                            checked={niveles.includes(n.valor)}
                            onChange={() => toggleNivel(n.valor)} />
                          <label className="form-check-label small" htmlFor={`nivel-${n.valor}`}>
                            {n.label}
                          </label>
                        </div>
                      ))}
                      <button type="button" className="btn btn-sm btn-outline-secondary"
                        onClick={setTodosNiveles}>
                        <i className="bi bi-check2-all me-1"></i>Todos
                      </button>
                    </div>
                    {niveles.length === 0 && (
                      <small className="text-muted">Sin filtro = se muestran todos los niveles.</small>
                    )}
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="mostrar-ceros"
                        checked={mostrarCeros} onChange={e => onCeros(e.target.checked)} />
                      <label className="form-check-label small" htmlFor="mostrar-ceros">
                        <i className="bi bi-ui-checks me-1"></i>Mostrar renglones en cero
                      </label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Libros (tipos de comprobante)</label>
                    <MultiSelect options={opciones.comprobantes}
                      value={libro} onChange={onLibro}
                      getKey={c => c.codigo}
                      getLabel={c => `${c.codigo} — ${c.descripcion || ''}`}
                      placeholder="Todos" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Cuentas</label>
                    <MultiSelect options={opciones.cuentas}
                      value={cuenta} onChange={onCuenta}
                      getKey={c => c.codigo}
                      getLabel={c => `${c.codigo} — ${c.descripcion}`}
                      placeholder="Todas" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Centros de costo</label>
                    <MultiSelect options={opciones.centros}
                      value={centro} onChange={onCentro}
                      getKey={c => c.codigo}
                      getLabel={c => `${c.codigo} — ${c.descripcion}`}
                      placeholder="Todos" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {loading && <Spinner text="Generando reporte..." />}

        {/* ── Balance General ── */}
        {dataR && tipo === 'balance_general' && (
          <div>
            {/* Ecuación contable */}
            <div className={`alert ${dataR.ecuacion_ok ? 'alert-success' : 'alert-danger'} d-flex align-items-center gap-2 mb-4`}>
              <i className={`bi ${dataR.ecuacion_ok ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
              <span>
                <strong>Ecuación contable:</strong>&nbsp;
                Activos {formatMoney(dataR.total_activos)} =
                Pasivos {formatMoney(dataR.total_pasivos)} +
                Patrimonio {formatMoney(dataR.total_patrimonio)} +
                Ingresos {formatMoney(dataR.ingresos)} -
                Gastos {formatMoney(dataR.gastos)}
                &nbsp;{dataR.ecuacion_ok ? '✓ Cuadra' : <>✗ No cuadra — Diferencia: {formatMoney(dataR.diferencia)}</>}
              </span>
            </div>

            <div className="row g-3">
              {/* Activos */}
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-success text-white fw-semibold">
                    <i className="bi bi-bank me-2"></i>ACTIVOS — Clase 1
                  </div>
                  <div className="table-responsive" style={{maxHeight:400,overflowY:'auto'}}>
                    <table className="table table-sm mb-0">
                      <tbody>
                        {(dataR.activos||[]).map(c => (
                          <tr key={c.codigo}>
                            <td><code className="small">{c.codigo}</code></td>
                            <td className="small">{c.descripcion}</td>
                            <td className="text-end small fw-semibold">{formatMoney(c.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-success fw-bold">
                        <tr>
                          <td colSpan={2}>Total Activos</td>
                          <td className="text-end">{formatMoney(dataR.total_activos)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Pasivos */}
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-danger text-white fw-semibold">
                    <i className="bi bi-credit-card me-2"></i>PASIVOS — Clase 2
                  </div>
                  <div className="table-responsive" style={{maxHeight:400,overflowY:'auto'}}>
                    <table className="table table-sm mb-0">
                      <tbody>
                        {(dataR.pasivos||[]).map(c => (
                          <tr key={c.codigo}>
                            <td><code className="small">{c.codigo}</code></td>
                            <td className="small">{c.descripcion}</td>
                            <td className="text-end small fw-semibold">{formatMoney(c.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-danger fw-bold">
                        <tr>
                          <td colSpan={2}>Total Pasivos</td>
                          <td className="text-end">{formatMoney(dataR.total_pasivos)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Patrimonio */}
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-primary text-white fw-semibold">
                    <i className="bi bi-shield-check me-2"></i>PATRIMONIO — Clase 3
                  </div>
                  <div className="table-responsive" style={{maxHeight:400,overflowY:'auto'}}>
                    <table className="table table-sm mb-0">
                      <tbody>
                        {(dataR.patrimonio||[]).map(c => (
                          <tr key={c.codigo}>
                            <td><code className="small">{c.codigo}</code></td>
                            <td className="small">{c.descripcion}</td>
                            <td className="text-end small fw-semibold">{formatMoney(c.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-primary fw-bold">
                        <tr>
                          <td colSpan={2}>Total Patrimonio</td>
                          <td className="text-end">{formatMoney(dataR.total_patrimonio)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Ingresos y Gastos */}
            <div className="row g-3 mt-0">
              <div className="col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-info text-white fw-semibold">
                    <i className="bi bi-graph-up-arrow me-2"></i>INGRESOS — Clase 4
                  </div>
                  <div className="table-responsive" style={{maxHeight:400,overflowY:'auto'}}>
                    <table className="table table-sm mb-0">
                      <tbody>
                        {(dataR.ingresos_rows||[]).map(c => (
                          <tr key={c.codigo}>
                            <td><code className="small">{c.codigo}</code></td>
                            <td className="small">{c.descripcion}</td>
                            <td className="text-end small fw-semibold">{formatMoney(c.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-info fw-bold">
                        <tr>
                          <td colSpan={2}>Total Ingresos</td>
                          <td className="text-end">{formatMoney(dataR.ingresos)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-secondary text-white fw-semibold">
                    <i className="bi bi-graph-down-arrow me-2"></i>GASTOS — Clase 5
                  </div>
                  <div className="table-responsive" style={{maxHeight:400,overflowY:'auto'}}>
                    <table className="table table-sm mb-0">
                      <tbody>
                        {(dataR.gastos_rows||[]).map(c => (
                          <tr key={c.codigo}>
                            <td><code className="small">{c.codigo}</code></td>
                            <td className="small">{c.descripcion}</td>
                            <td className="text-end small fw-semibold">{formatMoney(c.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-secondary fw-bold">
                        <tr>
                          <td colSpan={2}>Total Gastos</td>
                          <td className="text-end">{formatMoney(dataR.gastos)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Estado de Resultados ── */}
        {dataR && tipo === 'estado_resultados' && (
          <div className="row g-3">
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-info text-white fw-semibold">
                  <i className="bi bi-graph-up-arrow me-2"></i>INGRESOS — Clase 4
                </div>
                <div className="table-responsive" style={{maxHeight:350,overflowY:'auto'}}>
                  <table className="table table-sm mb-0">
                    <tbody>
                      {(dataR.ingresos_rows||[]).map(c => (
                        <tr key={c.codigo}>
                          <td><code className="small">{c.codigo}</code></td>
                          <td className="small">{c.descripcion}</td>
                          <td className="text-end small">{formatMoney(c.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-info fw-bold">
                      <tr>
                        <td colSpan={2}>Total Ingresos</td>
                        <td className="text-end">{formatMoney(dataR.ingresos)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-secondary text-white fw-semibold">
                  <i className="bi bi-graph-down-arrow me-2"></i>GASTOS — Clase 5
                </div>
                <div className="table-responsive" style={{maxHeight:350,overflowY:'auto'}}>
                  <table className="table table-sm mb-0">
                    <tbody>
                      {(dataR.gastos_rows||[]).map(c => (
                        <tr key={c.codigo}>
                          <td><code className="small">{c.codigo}</code></td>
                          <td className="small">{c.descripcion}</td>
                          <td className="text-end small">{formatMoney(c.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-secondary fw-bold">
                      <tr>
                        <td colSpan={2}>Total Gastos</td>
                        <td className="text-end">{formatMoney(dataR.gastos)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Resultado */}
            <div className="col-12">
              <div className={`card border-0 shadow-sm ${dataR.utilidad >= 0 ? 'bg-success' : 'bg-danger'} text-white`}>
                <div className="card-body d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="mb-0 fw-bold">
                      {dataR.utilidad >= 0 ? 'UTILIDAD DEL PERÍODO' : 'PÉRDIDA DEL PERÍODO'}
                    </h5>
                    <small className="opacity-75">{dataR.fecha_desde} al {dataR.fecha_hasta}</small>
                  </div>
                  <h3 className="mb-0 fw-bold">{formatMoney(dataR.utilidad)}</h3>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Balance de Comprobación ── */}
        {dataR && tipo === 'balance_comprobacion' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold">
              Balance de Comprobación
            </div>
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead>
                  <tr>
                    <th style={{ backgroundColor:'#006064', color:'#fff', fontSize:'0.95rem' }}>Código</th>
                    <th style={{ backgroundColor:'#006064', color:'#fff', fontSize:'0.95rem' }}>Descripción</th>
                    <th className="text-center" style={{ backgroundColor:'#006064', color:'#fff', fontSize:'0.95rem' }}>Niv.</th>
                    <th className="text-center" style={{ backgroundColor:'#006064', color:'#fff', fontSize:'0.95rem' }}>Clase</th>
                    <th className="text-end" style={{ backgroundColor:'#006064', color:'#fff', fontSize:'0.95rem' }}>Saldo Anterior</th>
                    <th className="text-end" style={{ backgroundColor:'#006064', color:'#fff', fontSize:'0.95rem' }}>Débitos</th>
                    <th className="text-end" style={{ backgroundColor:'#006064', color:'#fff', fontSize:'0.95rem' }}>Créditos</th>
                    <th className="text-end" style={{ backgroundColor:'#006064', color:'#fff', fontSize:'0.95rem' }}>Nuevo Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {(dataR.rows||[]).filter(filaVisible).map((r, i) => {
                    const padCodigo = r.tipo === 'centro' ? '2ch' : (r.tipo === 'cedula' ? '2rem' : '0');
                    const indentDesc = r.tipo === 'cuenta'
                      ? Math.max(0, parseInt(r.nivel, 10) - 1)
                      : (r.tipo === 'centro' ? 4 : 5);
                    const esDetalle = r.tipo !== 'cuenta';
                    const esCedula = r.tipo === 'cedula';
                    const esSin = r.codigo === 'SIN';
                    const fs = tamanioNivel(r.nivel);
                    const it = esCedula ? 'italic' : 'normal';
                    const est = NIVEL_ESTILO[r.nivel] || {};
                    const bgCelda = est.bg ? { backgroundColor: est.bg } : {};
                    const blanca = r.nivel === '1';
                    const cBase = blanca ? '#ffffff' : undefined;
                    const cAnterior = blanca ? (r.anterior < 0 ? '#ffb3b3' : '#ffffff') : undefined;
                    const cSaldo = r.nivel === '1' ? (r.saldo < 0 ? '#ffb3b3' : '#ffffff')
                      : (r.nivel === '2' || r.nivel === '3') ? '#000000'
                      : undefined;
                    const saldoCls = (r.nivel === '2' || r.nivel === '3')
                      ? 'text-end fw-bold'
                      : `text-end fw-semibold ${r.saldo < 0 ? 'text-danger' : 'text-success'}`;
                    const estiloFila = {
                      ...(est.color ? { color: est.color } : {}),
                      fontWeight: r.es_padre || est.bold ? 600 : 'normal',
                    };
                    return (
                      <tr key={`${r.tipo}-${r.codigo}-${i}`}
                        className={r.es_padre ? 'fw-semibold' : ''}
                        style={estiloFila}>
                        <td style={{ ...bgCelda, color: cBase }}>
                          <span style={{ paddingLeft: padCodigo }}>
                            <code className="small" style={{ fontStyle: it }}>{r.codigo}</code>
                          </span>
                        </td>
                        <td className="small" style={{ paddingLeft: indentDesc * 16 + 4, fontStyle: it, ...bgCelda, color: cBase }}>
                          {esSin && <i className="bi bi-dash-circle me-1"></i>}
                          {r.descripcion} {esSin && <em className="text-muted">(sin dato asignado)</em>}
                        </td>
                        <td className="text-center" style={{ ...bgCelda, color: cBase }}>
                          <span className={`badge ${esDetalle ? 'bg-secondary' : 'bg-dark'}`}>{r.nivel}</span>
                        </td>
                        <td className="text-center" style={{ ...bgCelda, color: cBase }}>
                          {r.clase ? (
                            <span className="badge" style={{ backgroundColor: CLASE_BG[r.clase] || 'rgba(0,0,0,0.1)', color: '#000000' }}>
                              {r.clase}
                            </span>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td className={`text-end ${r.anterior < 0 ? 'text-danger' : ''}`} style={{ fontSize: fs, fontStyle: it, ...bgCelda, color: cAnterior }}>
                          {esDetalle ? formatMoney(r.anterior) : <strong>{formatMoney(r.anterior)}</strong>}
                        </td>
                        <td className={`text-end ${esDetalle ? '' : 'fw-semibold'}`} style={{ fontSize: fs, fontStyle: it, ...bgCelda, color: cBase }}>{formatMoney(r.debitos)}</td>
                        <td className={`text-end ${esDetalle ? '' : 'fw-semibold'}`} style={{ fontSize: fs, fontStyle: it, ...bgCelda, color: cBase }}>{formatMoney(r.creditos)}</td>
                        <td className={saldoCls} style={{ fontSize: fs, fontStyle: it, ...bgCelda, color: cSaldo }}>
                          {formatMoney(r.saldo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {dataR.totales && (
                  <tfoot className="table-dark">
                    <tr>
                      <td colSpan={4}>TOTALES</td>
                      <td className={`text-end ${dataR.totales.anterior < 0 ? 'text-danger' : ''}`}>
                        {formatMoney(dataR.totales.anterior)}
                      </td>
                      <td className="text-end">{formatMoney(dataR.totales.debitos)}</td>
                      <td className="text-end">{formatMoney(dataR.totales.creditos)}</td>
                      <td className={`text-end ${dataR.totales.saldo < 0 ? 'text-danger' : 'text-success'}`}>
                        {formatMoney(dataR.totales.saldo)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
              {(dataR.rows||[]).filter(filaVisible).length === 0 && (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-inbox me-2"></i>Sin movimientos en el rango seleccionado.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}