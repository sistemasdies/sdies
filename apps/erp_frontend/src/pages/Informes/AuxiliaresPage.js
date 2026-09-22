import { useEffect, useState, useCallback, useRef } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import MultiSelect from '../../components/common/MultiSelect';
import { getAuxiliares } from '../../api/auxiliares';
import { getComprobantes } from '../../api/comprobantes';
import { getCuentas } from '../../api/cuentas';
import { getCentrosCosto } from '../../api/centrosCosto';
import { getTerceros } from '../../api/terceros';
import { formatDate } from '../../utils/formato';
import toast from 'react-hot-toast';
import { usePreferencias } from '../../hooks/usePreferencias';

const ORDEN_CAMPOS = [
  { valor:'cuenta',       label:'Cuenta' },
  { valor:'fecha',        label:'Fecha' },
  { valor:'cedula',       label:'Cédula' },
  { valor:'centro_costo', label:'Centro de costo' },
];

const money = (v) => {
  if (v === '' || v === null || v === undefined) return '';
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(parseFloat(v));
};
const celda = (v) => (parseFloat(v || 0) === 0 ? '' : money(v));
const truncar = (s, n) => {
  const t = (s || '').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};

const FLT = {
  fecha_desde:'', fecha_hasta:'', cuenta:[], centro_costo:[], comprobante:[], tercero:[],
  saldos_iniciales:'no', subtotales_cedula:'no', orden1:'fecha', orden2:'cuenta', orden3:'cedula',
};

// Selector No/Sí compacto
const SiNo = ({ value, onChange, offLabel = 'No', onLabel = 'Sí' }) => (
  <div className="btn-group btn-group-sm w-100">
    <button type="button"
      className={`btn btn-sm ${value==='si' ? 'btn-outline-secondary' : 'btn-success'}`}
      onClick={() => onChange('no')}>{offLabel}</button>
    <button type="button"
      className={`btn btn-sm ${value==='si' ? 'btn-success' : 'btn-outline-secondary'}`}
      onClick={() => onChange('si')}>{onLabel}</button>
  </div>
);

export default function AuxiliaresPage() {
  const { data: prefs, guardar: guardarPrefs, estaListo: prefsListo } = usePreferencias();
  const hoy = new Date();
  const [filtros, setFiltros] = useState(() => ({
    ...FLT,
    fecha_desde: `${hoy.getFullYear()}-01-01`,
    fecha_hasta: hoy.toISOString().slice(0, 10),
  }));
  const [opciones, setOpciones] = useState({ comprobantes:[], cuentas:[], centros:[], terceros:[] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nav, setNav] = useState(0);
  const [resaltado, setResaltado] = useState(null);

  useEffect(() => {
    getComprobantes().then(r => setOpciones(o => ({ ...o, comprobantes:r.data.results || r.data }))).catch(()=>{});
    getCuentas({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, cuentas:r.data.results || r.data }))).catch(()=>{});
    getCentrosCosto().then(r => setOpciones(o => ({ ...o, centros:r.data.results || r.data }))).catch(()=>{});
    getTerceros({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, terceros:r.data.results || r.data }))).catch(()=>{});
  }, []);

  // Rehidratar filtros guardados cuando las preferencias están listas
  useEffect(() => {
    if (!prefsListo || !prefs) return;
    const guardados = prefs['auxiliares'];
    if (guardados) {
      setFiltros(f => ({
        ...FLT,
        fecha_desde: guardados.fecha_desde ?? f.fecha_desde,
        fecha_hasta: guardados.fecha_hasta ?? f.fecha_hasta,
        cuenta:         guardados.cuenta         ?? f.cuenta,
        centro_costo:   guardados.centro_costo   ?? f.centro_costo,
        comprobante:    guardados.comprobante    ?? f.comprobante,
        tercero:        guardados.tercero        ?? f.tercero,
        saldos_iniciales:  guardados.saldos_iniciales  ?? f.saldos_iniciales,
        subtotales_cedula: guardados.subtotales_cedula ?? f.subtotales_cedula,
        orden1: guardados.orden1 ?? f.orden1,
        orden2: guardados.orden2 ?? f.orden2,
        orden3: guardados.orden3 ?? f.orden3,
      }));
    }
  }, [prefsListo]);

  // Persistir filtros en preferencias cada vez que cambian (con debounce sencillo)
  useEffect(() => {
    if (!guardarPrefs) return;
    const prefsAtrasadas = setTimeout(() => {
      guardarPrefs({ 'auxiliares': filtros });
    }, 600);
    return () => clearTimeout(prefsAtrasadas);
  }, [filtros]);

  const buscar = () => {
    setLoading(true);
    const params = {
      fecha_desde: filtros.fecha_desde || undefined,
      fecha_hasta: filtros.fecha_hasta || undefined,
      cuenta:      filtros.cuenta.length      ? filtros.cuenta.join(',')      : undefined,
      centro_costo:filtros.centro_costo.length? filtros.centro_costo.join(',') : undefined,
      comprobante: filtros.comprobante.length ? filtros.comprobante.join(',') : undefined,
      cedula:      filtros.tercero.length     ? filtros.tercero.join(',')     : undefined,
      saldos_iniciales: filtros.saldos_iniciales,
      subtotales_cedula: filtros.subtotales_cedula,
      orden1: filtros.orden1, orden2: filtros.orden2, orden3: filtros.orden3,
    };
    Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
    getAuxiliares(params)
      .then(r => setData(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Error al consultar'))
      .finally(() => setLoading(false));
  };

  const limpiar = () => {
    setFiltros({ ...FLT, fecha_desde: `${hoy.getFullYear()}-01-01`, fecha_hasta: hoy.toISOString().slice(0, 10) });
    setData(null);
  };

  // Bloques por cédula dentro de una cuenta (las filas vienen ordenadas por cédula)
  const bloquesAux = useCallback((cuenta) => {
    const cedulasMap = {};
    (cuenta.cedulas || []).forEach(c => { cedulasMap[c.cedula] = c; });
    const bloques = [];
    let prev = null, b = null;
    cuenta.filas.forEach(r => {
      if (r.cedula !== prev) {
        if (b) bloques.push(b);
        b = {
          cedula: r.cedula, nombre: r.tercero_nombre,
          saldo_inicial: cedulasMap[r.cedula]?.saldo_inicial,
          subtotales: cedulasMap[r.cedula] || {},
          filas: [],
        };
      }
      b.filas.push(r);
      prev = r.cedula;
    });
    if (b) bloques.push(b);
    return bloques;
  }, []);

  // Items renderizables en orden correcto (pantalla y PDF idénticos)
  const construirItems = useCallback((cuentas) => {
    const items = [];
    const iniOn = filtros.saldos_iniciales === 'si';
    const ccOn  = filtros.subtotales_cedula === 'si';
    cuentas.forEach(cuenta => {
      const sinBand = !ccOn && iniOn;
      if (!sinBand) items.push({ tipo:'cuenta', codigo:cuenta.codigo, descripcion:cuenta.descripcion });

      if (ccOn) {
        bloquesAux(cuenta).forEach(b => {
          if (iniOn) items.push({ tipo:'saldo_inicial_bloque', cedula:b.cedula, nombre:b.nombre, monto:b.saldo_inicial });
          b.filas.forEach(r => items.push({ tipo:'linea', ...r }));
          items.push({
            tipo:'subtotal', cedula:b.cedula, nombre:b.nombre,
            codigo:cuenta.codigo, descripcion_corta:truncar(cuenta.descripcion, 25),
            subtotal_debitos: b.subtotales.subtotal_debitos,
            subtotal_creditos: b.subtotales.subtotal_creditos,
            subtotal_saldo: b.subtotales.subtotal_saldo,
          });
        });
      } else {
        if (iniOn) {
          items.push({
            tipo:'saldo_inicial_titulo', codigo:cuenta.codigo,
            descripcion:cuenta.descripcion, monto:cuenta.saldo_inicial,
          });
        }
        cuenta.filas.forEach(r => items.push({ tipo:'linea', ...r }));
      }

      items.push({
        tipo:'total', codigo:cuenta.codigo, descripcion:cuenta.descripcion,
        debitos:cuenta.subtotal_debitos, creditos:cuenta.subtotal_creditos,
        saldo:cuenta.subtotal_saldo,
      });
    });
    return items;
  }, [filtros.saldos_iniciales, filtros.subtotales_cedula, bloquesAux]);

  const items = data ? construirItems(data.cuentas) : [];

  // Subtotales navegables (subtotales por cédula + totales por cuenta)
  const subtotales = items.map((it, i) =>
    (it.tipo === 'subtotal' || it.tipo === 'total')
      ? {
          i,
          label: it.tipo === 'total'
            ? `Total cuenta ${it.codigo} — ${it.descripcion}`
            : `Subtotal — Cuenta ${it.codigo} (${it.descripcion_corta}) y Cédula ${it.cedula || '—'}${it.nombre ? ` (${it.nombre})` : ''}`,
        }
      : null
  ).filter(Boolean);

  useEffect(() => { setNav(0); setResaltado(null); }, [data]);
  const flashRef = useRef(null);

  const irA = (pos) => {
    const n = Math.max(0, Math.min(subtotales.length - 1, pos));
    setNav(n);
    const item = subtotales[n];
    if (!item) return;
    const el = document.getElementById('sub-' + item.i);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setResaltado(item.i);
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setResaltado(null), 1800);
  };

  const FilaLinea = ({ r }) => (
    <tr>
      <td><code className="small">{r.cod_comprob}</code></td>
      <td className="text-center small">{r.num_comprob}</td>
      <td className="text-center small">{r.item_comprob}</td>
      <td className="small">{formatDate(r.fecha)}</td>
      <td className="small">{r.cedula || ''}</td>
      <td className="small" style={{ maxWidth:160, minWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
        title={r.apellido_nombre || ''}>{r.apellido_nombre || ''}</td>
      <td className="small">{r.centro_costo || ''}</td>
      <td className="small" style={{ maxWidth:240, minWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
        title={r.observacion || ''}>{r.observacion || ''}</td>
      <td className="small">{r.doc_ref || ''}</td>
      <td className="text-end small">{celda(r.debito)}</td>
      <td className="text-end small">{celda(r.credito)}</td>
      <td className="text-end small fw-semibold">{money(r.saldo)}</td>
    </tr>
  );

  const FilaSaldoIni = ({ monto, text }) => (
    <tr className="table-secondary">
      <td colSpan={9} className="small fst-italic">{text}</td>
      <td className="small"></td>
      <td className="small"></td>
      <td className="text-end small fw-semibold">{money(monto)}</td>
    </tr>
  );

  const CuerpoTabla = () => (
    <tbody>
      {items.map((it, i) => {
        switch (it.tipo) {
          case 'cuenta':
            return (
              <tr key={i} style={{ backgroundColor:'#212529', color:'#fff' }}>
                <td colSpan={12} className="fw-bold py-1">
                  <i className="bi bi-diagram-3 me-2"></i>{it.codigo} — {it.descripcion}
                </td>
              </tr>
            );
          case 'saldo_inicial_titulo':
            return (
              <tr key={i} style={{ backgroundColor:'#212529', color:'#fff' }}>
                <td colSpan={9} className="fw-bold py-1">
                  <i className="bi bi-diagram-3 me-2"></i>
                  CUENTA {it.codigo} — {it.descripcion}
                  <span className="fw-normal" style={{ color:'#8ab4f8' }}>&nbsp;·&nbsp;Saldo inicial (anterior al período)</span>
                </td>
                <td></td>
                <td></td>
                <td className="text-end fw-bold">{money(it.monto)}</td>
              </tr>
            );
          case 'saldo_inicial':
            return <FilaSaldoIni key={i} text="Saldo inicial (anterior al período)" monto={it.monto} />;
          case 'saldo_inicial_bloque':
            return <FilaSaldoIni key={i}
              text={`Saldo inicial — Cédula ${it.cedula || '—'}${it.nombre ? ` (${it.nombre})` : ''}`}
              monto={it.monto} />;
          case 'linea':
            return <FilaLinea key={i} r={it} />;
          case 'subtotal':
            return (
              <tr key={i} id={'sub-' + i} className="table-warning fw-bold"
                style={{ outline: resaltado === i ? '3px solid #0d6efd' : undefined, outlineOffset:'-2px' }}>
                <td colSpan={8} className="small ps-4">Subtotal — Cuenta {it.codigo} ({it.descripcion_corta}) y Cédula {it.cedula || '—'}{it.nombre ? ` (${it.nombre})` : ''}</td>
                <td className="small"></td>
                <td className="text-end small">{celda(it.subtotal_debitos)}</td>
                <td className="text-end small">{celda(it.subtotal_creditos)}</td>
                <td className="text-end small">{money(it.subtotal_saldo)}</td>
              </tr>
            );
          case 'total':
            return (
              <tr key={i} id={'sub-' + i} className="table-info fw-bold"
                style={{ outline: resaltado === i ? '3px solid #0d6efd' : undefined, outlineOffset:'-2px' }}>
                <td colSpan={8} className="small">Total cuenta {it.codigo} — {it.descripcion}</td>
                <td className="small"></td>
                <td className="text-end small">{celda(it.debitos)}</td>
                <td className="text-end small">{celda(it.creditos)}</td>
                <td className="text-end small">{money(it.saldo)}</td>
              </tr>
            );
          default:
            return null;
        }
      })}
    </tbody>
  );

  // ── Exportar PDF (ventana de impresión del navegador) ─────────────────
  const imprimirPDF = () => {
    if (!data) return;
    const iniOn = filtros.saldos_iniciales === 'si';
    const ccOn  = filtros.subtotales_cedula === 'si';

    const lineaHTML = (r) => `
      <tr>
        <td><code>${r.cod_comprob}</code></td>
        <td class="cen">${r.num_comprob}</td>
        <td class="cen">${r.item_comprob}</td>
        <td>${formatDate(r.fecha)}</td>
        <td>${r.cedula || ''}</td>
        <td class="ape">${r.apellido_nombre || ''}</td>
        <td>${r.centro_costo || ''}</td>
        <td class="obs">${r.observacion || ''}</td>
        <td>${r.doc_ref || ''}</td>
        <td class="der">${celda(r.debito)}</td>
        <td class="der">${celda(r.credito)}</td>
        <td class="der saldo">${money(r.saldo)}</td>
      </tr>`;

    const filasHTML = items.map(it => {
      if (it.tipo === 'cuenta') return `
        <tr class="grupo-cuenta"><td colspan="12">${it.codigo} — ${it.descripcion}</td></tr>`;
      if (it.tipo === 'saldo_inicial_titulo') return `
        <tr class="grupo-cuenta">
          <td colspan="9">CUENTA ${it.codigo} — ${it.descripcion} &nbsp;·&nbsp; Saldo inicial (anterior al período)</td>
          <td class="der"></td><td class="der"></td><td class="der saldo">${money(it.monto)}</td>
        </tr>`;
      if (it.tipo === 'saldo_inicial') return `
        <tr class="saldo-ini">
          <td colspan="9">Saldo inicial (anterior al período)</td>
          <td class="der"></td><td class="der"></td><td class="der saldo">${money(it.monto)}</td>
        </tr>`;
      if (it.tipo === 'saldo_inicial_bloque') return `
        <tr class="saldo-ini">
          <td colspan="9">Saldo inicial — Cédula ${it.cedula || '—'}${it.nombre ? ` (${it.nombre})` : ''}</td>
          <td class="der"></td><td class="der"></td><td class="der saldo">${money(it.monto)}</td>
        </tr>`;
      if (it.tipo === 'linea') return lineaHTML(it);
      if (it.tipo === 'subtotal') return `
        <tr class="subtotal">
          <td colspan="8">Subtotal — Cuenta ${it.codigo} (${it.descripcion_corta}) y Cédula ${it.cedula || '—'}${it.nombre ? ` (${it.nombre})` : ''}</td>
          <td class="der"></td>
          <td class="der">${celda(it.subtotal_debitos)}</td>
          <td class="der">${celda(it.subtotal_creditos)}</td>
          <td class="der saldo">${money(it.subtotal_saldo)}</td>
        </tr>`;
      if (it.tipo === 'total') return `
        <tr class="total">
          <td colspan="8">Total cuenta ${it.codigo} — ${it.descripcion}</td>
          <td class="der"></td>
          <td class="der">${celda(it.debitos)}</td>
          <td class="der">${celda(it.creditos)}</td>
          <td class="der saldo">${money(it.saldo)}</td>
        </tr>`;
      return '';
    }).join('');

    const filtrosTxt = [];
    if (filtros.fecha_desde) filtrosTxt.push(`Desde: ${formatDate(filtros.fecha_desde)}`);
    if (filtros.fecha_hasta) filtrosTxt.push(`Hasta: ${formatDate(filtros.fecha_hasta)}`);
    if (filtros.cuenta.length)       filtrosTxt.push(`Cuentas: ${filtros.cuenta.join(', ')}`);
    if (filtros.centro_costo.length) filtrosTxt.push(`Centros: ${filtros.centro_costo.join(', ')}`);
    if (filtros.comprobante.length)  filtrosTxt.push(`Comprobantes: ${filtros.comprobante.join(', ')}`);
    if (filtros.tercero.length)      filtrosTxt.push(`Cédulas: ${filtros.tercero.join(', ')}`);
    filtrosTxt.push(`Orden: ${[filtros.orden1, filtros.orden2, filtros.orden3].map(o => ORDEN_CAMPOS.find(x => x.valor === o)?.label || o).join(', ')}`);
    if (iniOn) filtrosTxt.push('Con saldos iniciales');
    if (ccOn)  filtrosTxt.push('Subtotales por cédula');

    const totalFila = data.cuentas.reduce((acc, c) => ({
      deb: acc.deb + parseFloat(c.subtotal_debitos),
      cre: acc.cre + parseFloat(c.subtotal_creditos),
    }), { deb:0, cre:0 });
    const saldoTotal = money(data.cuentas.reduce((a, c) => a + parseFloat(c.subtotal_saldo), 0));

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Auxiliares</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    body { font-family:Arial,sans-serif; font-size:8.5px; color:#000; }
    .encabezado { text-align:center; margin-bottom:8px; padding-bottom:6px; border-bottom:2px solid #000; }
    .encabezado h2 { font-size:13px; font-weight:bold; }
    .encabezado p  { font-size:7.5px; color:#444; margin-top:2px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#2d3748; color:#fff; padding:3px 4px; font-size:6.8px; text-transform:uppercase; letter-spacing:.03em; border:1px solid #2d3748; }
    td { padding:2px 4px; border-bottom:1px solid #e2e8f0; border-left:1px solid #e2e8f0; border-right:1px solid #e2e8f0; }
    .der { text-align:right; white-space:nowrap; }
    .saldo { font-weight:bold; }
    td.obs { max-width:156px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    td.ape { max-width:104px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cen { text-align:center; }
    code { font-family:Consolas,monospace; }
    tr.grupo-cuenta td { background:#e8eef7; color:#000; font-weight:bold; font-size:8.5px; border:1px solid #b0b7c3; }
    tr.saldo-ini td { background:#f1f5f9; font-style:italic; }
    tr.subtotal td { background:#fef3c7; font-weight:bold; border-top:1px solid #f59e0b; }
    tr.total td { background:#e0f2fe; font-weight:bold; border-top:2px solid #0ea5e9; }
    .pie { margin-top:8px; font-size:7px; color:#888; display:flex; justify-content:space-between; border-top:1px solid #ddd; padding-top:3px; }
    @media print {
      @page { size:A4 landscape; margin:8mm; }
      thead { display:table-header-group; }
      tr { page-break-inside:avoid; }
    }
  </style>
</head>
<body>
  <div class="encabezado">
    <h2>Informe de Auxiliares</h2>
    <p>${filtrosTxt.join(' &nbsp;|&nbsp; ')} &nbsp;|&nbsp; Generado: ${new Date().toLocaleString('es-CO')}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Comp</th><th class="cen">Nº</th><th class="cen">Item</th><th>Fecha</th>
        <th>Cédula</th><th>Apellido Nombre</th><th>Centro</th><th>Observación</th><th>DocRef</th>
        <th class="der">Débito</th><th class="der">Crédito</th><th class="der">Saldo</th>
      </tr>
    </thead>
    ${filasHTML}
    <tfoot>
      <tr class="total">
        <td colspan="8">TOTALES GENERALES</td>
        <td class="der"></td>
        <td class="der">${money(totalFila.deb)}</td>
        <td class="der">${money(totalFila.cre)}</td>
        <td class="der saldo">${saldoTotal}</td>
      </tr>
    </tfoot>
  </table>
  <div class="pie">
    <span>SDIES — Informe de Auxiliares</span>
    <span>${data.cuentas.length} cuenta(s)</span>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=1000,height=700');
    if (!ventana) { toast.error('Permita ventanas emergentes para exportar'); return; }
    ventana.document.write(html);
    ventana.document.close();
  };

  const numLineas = data ? data.cuentas.reduce((a, c) => a + c.filas.length, 0) : 0;

  return (
    <MainLayout>
      <TopBar title="Auxiliares" />
      <div className="p-4">
        <PageHeader title="Informe de Auxiliares"
          subtitle={data ? `${data.cuentas.length} cuenta(s) · ${numLineas} movimiento(s)` : 'Detalle de movimientos contables por cuenta'}>
          <button className="btn btn-outline-secondary" onClick={imprimirPDF} disabled={!data || numLineas === 0}>
            <i className="bi bi-printer me-1"></i>Exportar PDF
          </button>
        </PageHeader>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end mb-2">
              <div className="col-md-2">
                <label className="form-label small mb-1">Fecha desde</label>
                <input type="date" className="form-control form-control-sm"
                  value={filtros.fecha_desde}
                  onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Fecha hasta</label>
                <input type="date" className="form-control form-control-sm"
                  value={filtros.fecha_hasta}
                  onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Comprobante</label>
                <MultiSelect options={opciones.comprobantes} value={filtros.comprobante}
                  getKey={c => c.codigo} getLabel={c => c.codigo}
                  onChange={v => setFiltros(f => ({ ...f, comprobante: v }))} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">Cuenta</label>
                <MultiSelect options={opciones.cuentas} value={filtros.cuenta}
                  getKey={c => c.codigo} getLabel={c => `${c.codigo} — ${c.descripcion}`}
                  onChange={v => setFiltros(f => ({ ...f, cuenta: v }))} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">Centro de costo</label>
                <MultiSelect options={opciones.centros} value={filtros.centro_costo}
                  getKey={cc => cc.codigo} getLabel={cc => `${cc.codigo} — ${cc.descripcion}`}
                  onChange={v => setFiltros(f => ({ ...f, centro_costo: v }))} />
              </div>
            </div>

            <div className="row g-2 align-items-end mb-2">
              <div className="col-md-4">
                <label className="form-label small mb-1">Terceros</label>
                <MultiSelect options={opciones.terceros} value={filtros.tercero}
                  getKey={t => t.cedula} getLabel={t => `${t.cedula} — ${t.nombre_completo}`}
                  onChange={v => setFiltros(f => ({ ...f, tercero: v }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Saldos iniciales</label>
                <SiNo value={filtros.saldos_iniciales}
                  onChange={v => setFiltros(f => ({ ...f, saldos_iniciales: v }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Subtotal cédula</label>
                <SiNo value={filtros.subtotales_cedula}
                  onChange={v => setFiltros(f => ({ ...f, subtotales_cedula: v }))} />
              </div>
              <div className="col-md-4 d-flex gap-2 align-items-end">
                <button className="btn btn-primary btn-sm px-3" onClick={buscar}>
                  <i className="bi bi-search me-1"></i>Buscar
                </button>
                <button className="btn btn-outline-danger btn-sm" onClick={limpiar}>
                  <i className="bi bi-x-circle me-1"></i>Limpiar
                </button>
              </div>
            </div>

            <div className="row g-2 align-items-end">
              {[['orden1','Orden 1º'],['orden2','Orden 2º'],['orden3','Orden 3º']].map(([campo, label]) => (
                <div className="col-md-2" key={campo}>
                  <label className="form-label small mb-1">{label}</label>
                  <select className="form-select form-select-sm" value={filtros[campo]}
                    onChange={e => setFiltros(f => ({ ...f, [campo]: e.target.value }))}>
                    {ORDEN_CAMPOS.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="card border-0 shadow-sm">
          {loading ? <div className="p-4"><Spinner /></div> : !data ? (
            <div className="card-body text-center text-muted py-5">
              <i className="bi bi-search display-5 d-block mb-2 text-secondary"></i>
              Aplique los filtros y presione <strong>Buscar</strong> para generar el informe.
            </div>
          ) : numLineas === 0 ? (
            <div className="card-body text-center text-muted py-5">
              <i className="bi bi-inbox display-5 d-block mb-2 text-secondary"></i>
              Sin movimientos para los filtros seleccionados.
            </div>
          ) : (
            <>
              {subtotales.length > 0 && (
                <div className="card-header bg-white d-flex flex-wrap align-items-center gap-2 justify-content-end py-2">
                  <span className="small text-muted me-1">Subtotal</span>
                  <button className="btn btn-sm btn-outline-primary" disabled={nav <= 0}
                    onClick={() => irA(nav - 1)} title="Subtotal anterior">
                    <i className="bi bi-chevron-left"></i> Anterior
                  </button>
                  <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 320 }}
                    value={nav} onChange={e => irA(parseInt(e.target.value, 10))}>
                    {subtotales.map((s, j) => (
                      <option key={j} value={j}>{j + 1}. {s.label}</option>
                    ))}
                  </select>
                  <button className="btn btn-sm btn-outline-primary" disabled={nav >= subtotales.length - 1}
                    onClick={() => irA(nav + 1)} title="Subtotal siguiente">
                    Siguiente <i className="bi bi-chevron-right"></i>
                  </button>
                  <span className="small text-muted">{nav + 1} / {subtotales.length}</span>
                </div>
              )}
            <div className="table-responsive" style={{ maxHeight:'65vh', overflowY:'auto' }}>
              <table className="table table-sm table-bordered align-middle mb-0">
                <thead className="table-dark" style={{ position:'sticky', top:0, zIndex:1 }}>
                  <tr>
                    <th>Comp</th><th className="text-center">Nº</th><th className="text-center">Item</th>
                    <th>Fecha</th><th>Cédula</th><th>Apellido Nombre</th><th>Centro</th><th>Observación</th><th>DocRef</th>
                    <th className="text-end">Débito</th><th className="text-end">Crédito</th><th className="text-end">Saldo</th>
                  </tr>
                </thead>
                <CuerpoTabla />
                <tfoot>
                  <tr className="table-info fw-bold">
                    <td colSpan={9}>TOTALES GENERALES</td>
                    <td className="text-end">{celda(data.total_debitos)}</td>
                    <td className="text-end">{celda(data.total_creditos)}</td>
                    <td className="text-end">{money(data.cuentas.reduce((a, c) => a + parseFloat(c.subtotal_saldo), 0))}</td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}