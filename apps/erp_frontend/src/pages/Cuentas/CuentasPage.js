import { useEffect, useState, useCallback, useRef } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import { getCuentasArbol, getCuentas, createCuenta, updateCuenta, deleteCuenta } from '../../api/cuentas';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

// ── Reglas de inferencia ──────────────────────────────────────────────────
const inferirCampos = (codigo) => {
  if (!codigo || !/^\d+$/.test(codigo)) return null;
  const n      = codigo.length;
  const inicio = codigo[0];
  return {
    nivel:       n===1?'1':n===2?'2':n===4?'3':'4',
    tipo_pgmd:   n===1?'P':n===2?'G':n===4?'M':'D',
    naturaleza:  ['1','5'].includes(inicio) ? 'D' : 'C',
    clase_aptig: {'1':'A','2':'P','3':'T','4':'I','5':'G'}[inicio] || 'A',
    es_detalle:  n === 6,
  };
};

const codigoPadreDesde = (codigo) => {
  const n = codigo.length;
  if (n===1) return null;
  if (n===2) return codigo[0];
  if (n===4) return codigo.substring(0,2);
  if (n===6) return codigo.substring(0,4);
  return null;
};

const CLASE_LABEL = { A:'Activo', P:'Pasivo', T:'Patrimonio', I:'Ingreso', G:'Gasto' };
const CLASE_COLOR = { A:'success', P:'danger', T:'warning', I:'info', G:'secondary' };
const NAT_LABEL   = { D:'Débito', C:'Crédito' };
const TIPO_LABEL  = { P:'Principal', G:'General', M:'Mayor', D:'Detalle' };

// ── Componente fila árbol ─────────────────────────────────────────────────
function CuentaRow({ cuenta, nivel = 0, onEdit, onDelete, canEdit, canDel }) {
  const [expandido, setExpandido] = useState(nivel < 2);
  const tieneHijos = cuenta.hijos && cuenta.hijos.length > 0;
  const nivelReal  = parseInt(cuenta.nivel || '1');

  const estiloFila = {
    1: { backgroundColor:'#1a202c', color:'#fff',     fontWeight:'bold' },
    2: { backgroundColor:'#4a5568', color:'#fff',     fontWeight:'bold' },
    3: { backgroundColor:'#edf2f7', color:'#1a202c',  fontWeight:'600'  },
    4: { backgroundColor:'#ffffff', color:'#1a202c'                     },
  }[nivelReal] || { backgroundColor:'#ffffff', color:'#1a202c' };

  return (
    <>
      <tr style={estiloFila}>
        <td style={{ paddingLeft: 16 + (nivelReal - 1) * 20 }}>
          {tieneHijos && (
            <button className="btn btn-link btn-sm p-0 me-1 text-muted"
              onClick={() => setExpandido(!expandido)}>
              <i className={`bi bi-chevron-${expandido?'down':'right'}`}></i>
            </button>
          )}
          <code className="small">{cuenta.codigo}</code>
        </td>
        <td className={`small ${nivelReal <= 2 ? 'fw-bold' : ''}`}>{cuenta.descripcion}</td>
        <td className="text-center">
          <span className="badge bg-secondary">{cuenta.nivel}</span>
        </td>
        <td className="text-center">
          {cuenta.naturaleza==='D'
            ? <span className="badge bg-info text-dark">Débito</span>
            : <span className="badge bg-warning text-dark">Crédito</span>}
        </td>
        <td className="text-center">
          <span className="badge bg-dark"
            title={TIPO_LABEL[cuenta.tipo_pgmd]}>
            {cuenta.tipo_pgmd||'—'}
          </span>
        </td>
        <td className="text-center">
          {cuenta.clase_aptig
            ? <span className={`badge bg-${CLASE_COLOR[cuenta.clase_aptig]||'secondary'}`}
                title={CLASE_LABEL[cuenta.clase_aptig]}>
                {cuenta.clase_aptig}
              </span>
            : <span className="text-muted">—</span>}
        </td>
        <td className="text-center">
          {cuenta.es_detalle
            ? <i className="bi bi-check-circle-fill text-success"></i>
            : <i className="bi bi-dash text-muted"></i>}
        </td>
        <td className="text-end">
          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => onEdit(cuenta)} disabled={!canEdit}>
            <i className="bi bi-pencil"></i>
          </button>
          <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(cuenta)}
            disabled={!canDel || tieneHijos}
            title={tieneHijos ? 'No se puede eliminar — tiene cuentas hijas' : 'Eliminar'}>
            <i className="bi bi-trash"></i>
          </button>
        </td>
      </tr>
      {expandido && tieneHijos && cuenta.hijos.map(hijo => (
        <CuentaRow key={hijo.id} cuenta={hijo} nivel={nivel+1}
          onEdit={onEdit} onDelete={onDelete} canEdit={canEdit} canDel={canDel} />
      ))}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function CuentasPage() {
  const [cuentas,      setCuentas]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState({ codigo:'', descripcion:'' });
  const [inferidos,    setInferidos]    = useState(null);
  const [codigoEstado, setCodigoEstado] = useState(''); // ''|'ok'|'existe'|'invalido'|'sin_padre'
  const [mensajeError, setMensajeError] = useState('');
  const [editando,     setEditando]     = useState(null);
  const [checking,     setChecking]     = useState(false);
  const descRef = useRef(null);
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  const cargar = useCallback(() => {
    setLoading(true);
    getCuentasArbol()
      .then(r => setCuentas(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Abrir modal ───────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null);
    setForm({ codigo:'', descripcion:'' });
    setInferidos(null);
    setCodigoEstado('');
    setMensajeError('');
    setModal(true);
  };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({ codigo: c.codigo, descripcion: c.descripcion });
    setInferidos(inferirCampos(c.codigo));
    setCodigoEstado('ok');
    setMensajeError('');
    setModal(true);
  };

  // ── Validar código al salir del campo ─────────────────────────────────
  const onCodigoBlur = async () => {
    const codigo = form.codigo.trim();
    if (!codigo) { setInferidos(null); setCodigoEstado(''); setMensajeError(''); return; }

    if (!/^\d+$/.test(codigo)) {
      setInferidos(null); setCodigoEstado('invalido');
      setMensajeError('El código debe ser numérico'); return;
    }
    if (![1,2,4,6].includes(codigo.length)) {
      setInferidos(null); setCodigoEstado('invalido');
      setMensajeError(`Longitud ${codigo.length} no válida — use 1, 2, 4 ó 6 dígitos`); return;
    }

    setChecking(true);
    try {
      // 1. ¿Ya existe?
      if (!editando) {
        const resEx = await getCuentas({ page_size: 10, search: codigo });
        const lista = resEx.data.results || resEx.data;
        if (lista.some(c => c.codigo === codigo)) {
          setInferidos(null); setCodigoEstado('existe');
          setMensajeError('Este código ya existe — use otro o edite la cuenta existente');
          return;
        }
      }

      // 2. ¿Existe el padre?
      const padCod = codigoPadreDesde(codigo);
      if (padCod) {
        const resPad  = await getCuentas({ page_size: 5, search: padCod });
        const listaPad = resPad.data.results || resPad.data;
        if (!listaPad.some(c => c.codigo === padCod)) {
          setInferidos(null); setCodigoEstado('sin_padre');
          setMensajeError(`El padre ${padCod} no existe — créelo primero`);
          return;
        }
      }

      // 3. Todo OK
      setInferidos(inferirCampos(codigo));
      setCodigoEstado('ok');
      setMensajeError('');
      setTimeout(() => descRef.current?.focus(), 50);

    } catch {
      setInferidos(inferirCampos(codigo));
      setCodigoEstado('ok');
      setMensajeError('');
    } finally {
      setChecking(false);
    }
  };

  // ── Guardar ───────────────────────────────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault();
    if (!inferidos)                    { toast.error('Ingrese un código válido'); return; }
    if (codigoEstado === 'existe')     { toast.error('Este código ya existe'); return; }
    if (codigoEstado === 'sin_padre')  { toast.error(mensajeError); return; }
    if (codigoEstado === 'invalido')   { toast.error(mensajeError); return; }
    try {
      const payload = {
        codigo:      form.codigo.trim(),
        descripcion: form.descripcion.trim(),
        ...inferidos,
      };
      if (editando) {
        await updateCuenta(editando.id, payload);
        toast.success('Cuenta actualizada');
      } else {
        await createCuenta(payload);
        toast.success('Cuenta creada');
      }
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.codigo?.[0] || 'Error al guardar');
    }
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar la cuenta ${c.codigo}?`)) return;
    try {
      await deleteCuenta(c.id);
      toast.success('Cuenta eliminada');
      cargar();
    } catch { toast.error('No se puede eliminar esta cuenta'); }
  };

  // ── Aplanar árbol en lista plana para el reporte ─────────────────────
  const aplanarCuentas = (lista, resultado = []) => {
    lista.forEach(c => {
      resultado.push(c);
      if (c.hijos?.length) aplanarCuentas(c.hijos, resultado);
    });
    return resultado;
  };

  // ── Generar ventana de impresión / PDF ────────────────────────────────
  const imprimirPDF = () => {
    const todas    = aplanarCuentas(cuentas);
    const filtradas = hayFiltros ? aplanarCuentas(mostrar) : todas;

    const filas = filtradas.map(c => `
      <tr class="niv${c.nivel}">
        <td class="cod">${c.codigo}</td>
        <td class="desc" style="padding-left:${4 + (parseInt(c.nivel)||1) * 10}px">
          ${c.descripcion}
        </td>
        <td class="cen">${c.nivel}</td>
        <td class="cen">${c.naturaleza || '—'}</td>
        <td class="cen">${c.tipo_pgmd  || '—'}</td>
        <td class="cen">${c.clase_aptig|| '—'}</td>
        <td class="cen">${c.es_detalle ? '✓' : ''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Plan de Cuentas</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,sans-serif; font-size:9px; color:#000; }

    .encabezado { text-align:center; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #000; }
    .encabezado h2 { font-size:13px; font-weight:bold; }
    .encabezado p  { font-size:8px; color:#555; margin-top:2px; }

    table { width:100%; border-collapse:collapse; }
    th {
      background:#2d3748; color:#fff; padding:4px 5px;
      font-size:8px; text-transform:uppercase; letter-spacing:.04em;
    }
    th.cen, td.cen { text-align:center; }
    td { padding:2px 5px; border-bottom:1px solid #e2e8f0; }
    td.cod { font-family:monospace; white-space:nowrap; }

    tr.niv1 td { background:#1a202c; color:#fff; font-weight:bold; font-size:10px; }
    tr.niv1 td.cod { color:#90cdf4; }
    tr.niv2 td { background:#4a5568; color:#fff; font-weight:bold; }
    tr.niv2 td.cod { color:#bee3f8; }
    tr.niv3 td { background:#edf2f7; font-weight:600; }
    tr.niv4 td { background:#fff; }

    .convenciones {
      margin-top:14px;
      border-top:1px solid #ccc;
      padding-top:8px;
      font-size:8px;
      color:#444;
    }
    .convenciones h4 {
      font-size:9px;
      font-weight:bold;
      margin-bottom:4px;
      text-transform:uppercase;
      letter-spacing:.04em;
    }
    .conv-grid {
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:6px 20px;
    }
    .conv-grupo strong { display:inline-block; min-width:16px; font-family:monospace; }

    .pie {
      margin-top:8px; font-size:7px; color:#888;
      display:flex; justify-content:space-between;
      border-top:1px solid #ddd; padding-top:3px;
    }

    @media print {
      @page { size:A4 portrait; margin:10mm; }
      body  { font-size:8px; }
    }
  </style>
</head>
<body>
  <div class="encabezado">
    <h2>Plan Único de Cuentas — PUC Colombia</h2>
    <p>
      ${filtradas.length} cuentas
      ${hayFiltros ? `| Con filtros activos` : ''}
      &nbsp;|&nbsp; Generado: ${new Date().toLocaleString('es-CO')}
    </p>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:70px">Código</th>
        <th>Descripción</th>
        <th class="cen" style="width:30px">Niv</th>
        <th class="cen" style="width:28px">Nat</th>
        <th class="cen" style="width:28px">Tip</th>
        <th class="cen" style="width:28px">Cla</th>
        <th class="cen" style="width:28px">Det</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>

  <!-- Convenciones -->
  <div class="convenciones">
    <h4>Convenciones</h4>
    <div class="conv-grid">
      <div class="conv-grupo">
        <div><strong>Naturaleza (Nat)</strong></div>
        <div><strong>D</strong> = Débito</div>
        <div><strong>C</strong> = Crédito</div>
      </div>
      <div class="conv-grupo">
        <div><strong>Tipo (Tip)</strong></div>
        <div><strong>P</strong> = Principal</div>
        <div><strong>G</strong> = General</div>
        <div><strong>M</strong> = Mayor</div>
        <div><strong>D</strong> = Detalle</div>
      </div>
      <div class="conv-grupo">
        <div><strong>Clase (Cla)</strong></div>
        <div><strong>A</strong> = Activo</div>
        <div><strong>P</strong> = Pasivo</div>
        <div><strong>T</strong> = Patrimonio</div>
        <div><strong>I</strong> = Ingreso</div>
        <div><strong>G</strong> = Gasto</div>
      </div>
    </div>
  </div>

  <div class="pie">
    <span>SDIES — Plan de Cuentas</span>
    <span>${filtradas.length} registros</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=850,height=900');
    ventana.document.write(html);
    ventana.document.close();
  };

  // ── Filtros multi-columna ─────────────────────────────────────────────
  const [filtros, setFiltros] = useState({
    codigo:'', descripcion:'',
    naturaleza:[], tipo_pgmd:[], clase_aptig:[], es_detalle:'', nivel:[],
  });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const toggleMulti = (campo, valor) => {
    setFiltros(prev => {
      const arr = prev[campo];
      return { ...prev, [campo]: arr.includes(valor) ? arr.filter(v=>v!==valor) : [...arr,valor] };
    });
  };

  const limpiarFiltros = () => setFiltros({
    codigo:'', descripcion:'',
    naturaleza:[], tipo_pgmd:[], clase_aptig:[], es_detalle:'', nivel:[],
  });

  const hayFiltros = filtros.codigo || filtros.descripcion ||
    filtros.naturaleza.length || filtros.tipo_pgmd.length ||
    filtros.clase_aptig.length || filtros.es_detalle || filtros.nivel.length;

  const hayFiltrosColumna =
    filtros.naturaleza.length || filtros.tipo_pgmd.length ||
    filtros.clase_aptig.length || filtros.es_detalle !== '' || filtros.nivel.length;

  // Aplica todos los filtros sobre la lista plana y reconstruye árbol
  const aplicarFiltros = (lista) => {
    // Si solo hay búsqueda por código/descripción → mantener jerarquía (padres visibles)
    // Si hay filtros de columna → modo estricto (solo coincidencias exactas, sin arrastrar padres)
    if (hayFiltrosColumna) {
      // Aplanar todo el árbol y filtrar estrictamente
      const planas = aplanarCuentas(lista);
      return planas.filter(c =>
        (!filtros.codigo      || c.codigo.includes(filtros.codigo)) &&
        (!filtros.descripcion || c.descripcion.toLowerCase().includes(filtros.descripcion.toLowerCase())) &&
        (!filtros.naturaleza.length  || filtros.naturaleza.includes(c.naturaleza)) &&
        (!filtros.tipo_pgmd.length   || filtros.tipo_pgmd.includes(c.tipo_pgmd)) &&
        (!filtros.clase_aptig.length || filtros.clase_aptig.includes(c.clase_aptig)) &&
        (filtros.es_detalle==='' || (filtros.es_detalle==='si')===c.es_detalle) &&
        (!filtros.nivel.length || filtros.nivel.includes(parseInt(c.nivel)))
      ).map(c => ({ ...c, hijos: [] }));
    }

    // Sin filtros de columna → filtrar árbol manteniendo jerarquía
    return lista.reduce((acc, c) => {
      const hijosF = aplicarFiltros(c.hijos||[]);
      const match =
        (!filtros.codigo      || c.codigo.includes(filtros.codigo)) &&
        (!filtros.descripcion || c.descripcion.toLowerCase().includes(filtros.descripcion.toLowerCase()));
      if (match || hijosF.length > 0)
        acc.push({ ...c, hijos: hijosF });
      return acc;
    }, []);
  };

  const mostrar = aplicarFiltros(cuentas);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <TopBar title="Plan de Cuentas" />
      <div className="p-4">
        <PageHeader title="Plan Único de Cuentas" subtitle="PUC Colombia — estructura jerárquica">
          <button className="btn btn-outline-secondary" onClick={imprimirPDF}>
            <i className="bi bi-printer me-1"></i>Imprimir / PDF
          </button>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nueva cuenta
          </button>
        </PageHeader>

        {/* ── Panel de filtros ── */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {/* Búsqueda rápida código */}
              <div className="input-group" style={{maxWidth:180}}>
                <span className="input-group-text bg-white py-1">
                  <i className="bi bi-search text-muted" style={{fontSize:12}}></i>
                </span>
                <input className="form-control form-control-sm border-start-0"
                  placeholder="Código..."
                  value={filtros.codigo}
                  onChange={e=>setFiltros(p=>({...p,codigo:e.target.value}))}/>
              </div>
              {/* Búsqueda rápida descripción */}
              <div className="input-group" style={{maxWidth:240}}>
                <span className="input-group-text bg-white py-1">
                  <i className="bi bi-search text-muted" style={{fontSize:12}}></i>
                </span>
                <input className="form-control form-control-sm border-start-0"
                  placeholder="Descripción..."
                  value={filtros.descripcion}
                  onChange={e=>setFiltros(p=>({...p,descripcion:e.target.value}))}/>
              </div>

              {/* Botón expandir filtros avanzados */}
              <button className={`btn btn-sm ${mostrarFiltros?'btn-primary':'btn-outline-primary'}`}
                onClick={()=>setMostrarFiltros(p=>!p)}>
                <i className="bi bi-funnel me-1"></i>
                Filtros
                {hayFiltros && <span className="badge bg-warning text-dark ms-1">
                  {[filtros.naturaleza.length,filtros.tipo_pgmd.length,
                    filtros.clase_aptig.length,filtros.es_detalle?1:0,
                    filtros.nivel.length]
                    .reduce((a,b)=>a+b,0) +
                    (filtros.codigo?1:0)+(filtros.descripcion?1:0)}
                </span>}
              </button>

              {hayFiltros && (
                <button className="btn btn-sm btn-outline-danger" onClick={limpiarFiltros}>
                  <i className="bi bi-x-circle me-1"></i>Limpiar
                </button>
              )}

              <span className="text-muted small ms-auto">
                {aplanarCuentas(mostrar).length} cuenta(s)
              </span>
            </div>

            {/* Filtros avanzados desplegables */}
            {mostrarFiltros && (
              <div className="mt-2 pt-2 border-top">
                <div className="d-flex align-items-start gap-3 flex-wrap" style={{fontSize:11}}>

                  {/* Naturaleza */}
                  <div className="d-flex align-items-center gap-1">
                    <span className="text-muted fw-semibold" style={{fontSize:10}}>Nat:</span>
                    <div className="d-flex" style={{gap:2}}>
                      {[['D','Débito','info'],['C','Crédito','warning']].map(([v,l,col])=>(
                        <button key={v} title={l}
                          className={`btn py-0 px-1 ${filtros.naturaleza.includes(v)?`btn-${col}`:`btn-outline-${col}`}`}
                          style={{fontSize:10,lineHeight:'18px',minWidth:22}}
                          onClick={()=>toggleMulti('naturaleza',v)}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tipo */}
                  <div className="d-flex align-items-center gap-1">
                    <span className="text-muted fw-semibold" style={{fontSize:10}}>Tipo:</span>
                    <div className="d-flex" style={{gap:2}}>
                      {[['P','Principal'],['G','General'],['M','Mayor'],['D','Detalle']].map(([v,l])=>(
                        <button key={v} title={l}
                          className={`btn py-0 px-1 ${filtros.tipo_pgmd.includes(v)?'btn-dark':'btn-outline-secondary'}`}
                          style={{fontSize:10,lineHeight:'18px',minWidth:22}}
                          onClick={()=>toggleMulti('tipo_pgmd',v)}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clase */}
                  <div className="d-flex align-items-center gap-1">
                    <span className="text-muted fw-semibold" style={{fontSize:10}}>Cla:</span>
                    <div className="d-flex" style={{gap:2}}>
                      {[['A','Activo','success'],['P','Pasivo','danger'],['T','Patrimonio','warning'],['I','Ingreso','info'],['G','Gasto','secondary']].map(([v,l,col])=>(
                        <button key={v} title={l}
                          className={`btn py-0 px-1 ${filtros.clase_aptig.includes(v)?`btn-${col}`:`btn-outline-${col}`} ${['warning','info'].includes(col)?'text-dark':''}`}
                          style={{fontSize:10,lineHeight:'18px',minWidth:22}}
                          onClick={()=>toggleMulti('clase_aptig',v)}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Detalle */}
                  <div className="d-flex align-items-center gap-1">
                    <span className="text-muted fw-semibold" style={{fontSize:10}}>Det:</span>
                    <div className="d-flex" style={{gap:2}}>
                      {[['','Todos'],['si','Sí'],['no','No']].map(([v,l])=>(
                        <button key={v} title={l}
                          className={`btn py-0 px-1 ${filtros.es_detalle===v?'btn-success':'btn-outline-secondary'}`}
                          style={{fontSize:10,lineHeight:'18px'}}
                          onClick={()=>setFiltros(p=>({...p,es_detalle:v}))}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nivel */}
                  <div className="d-flex align-items-center gap-1">
                    <span className="text-muted fw-semibold" style={{fontSize:10}}>Niv:</span>
                    <div className="d-flex" style={{gap:2}}>
                      {[1,2,3,4].map(v=>(
                        <button key={v} title={`Nivel ${v}`}
                          className={`btn py-0 px-1 ${filtros.nivel.includes(v)?'btn-dark':'btn-outline-dark'}`}
                          style={{fontSize:10,lineHeight:'18px',minWidth:22}}
                          onClick={()=>toggleMulti('nivel',v)}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabla árbol */}
        <div className="card border-0 shadow-sm">
          {loading ? <div className="card-body"><Spinner /></div> : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th className="text-center">Nivel</th>
                    <th className="text-center">Naturaleza</th>
                    <th className="text-center">Tipo</th>
                    <th className="text-center">Clase</th>
                    <th className="text-center">Detalle</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mostrar.map(c => (
                    <CuentaRow key={c.id} cuenta={c}
                      nivel={parseInt(c.nivel||'1') - 1}
                      onEdit={abrirEditar} onDelete={eliminar}
                      canEdit={canEdit} canDel={canDel} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal nueva/editar cuenta ── */}
      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-diagram-3 me-2"></i>
                  {editando ? 'Editar cuenta' : 'Nueva cuenta'}
                </h5>
                <button className="btn-close btn-close-white"
                  onClick={() => setModal(false)}></button>
              </div>

              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="row g-3">

                    {/* Código */}
                    <div className="col-5">
                      <label className="form-label small fw-semibold">
                        Código <span className="text-danger">*</span>
                      </label>
                      <input
                        className={`form-control font-monospace ${
                          ['existe','invalido','sin_padre'].includes(codigoEstado) ? 'is-invalid' :
                          codigoEstado === 'ok' ? 'is-valid' : ''}`}
                        value={form.codigo}
                        disabled={!!editando}
                        placeholder="1, 11, 1105, 110505"
                        onChange={e => {
                          setForm({ ...form, codigo: e.target.value });
                          setInferidos(null);
                          setCodigoEstado('');
                          setMensajeError('');
                        }}
                        onBlur={onCodigoBlur}
                        required
                      />
                      {checking && (
                        <div className="form-text text-muted">
                          <span className="spinner-border spinner-border-sm me-1"></span>
                          Verificando...
                        </div>
                      )}
                      {['existe','invalido','sin_padre'].includes(codigoEstado) && (
                        <div className="invalid-feedback d-block">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          {mensajeError}
                        </div>
                      )}
                      {codigoEstado === 'ok' && !editando && (
                        <div className="valid-feedback d-block">
                          <i className="bi bi-check-circle me-1"></i>Disponible
                        </div>
                      )}
                    </div>

                    {/* Descripción */}
                    <div className="col-7">
                      <label className="form-label small fw-semibold">
                        Descripción <span className="text-danger">*</span>
                      </label>
                      <input ref={descRef} className="form-control"
                        value={form.descripcion}
                        placeholder="Nombre de la cuenta"
                        disabled={codigoEstado !== 'ok'}
                        onChange={e => setForm({ ...form, descripcion: e.target.value })}
                        required />
                    </div>

                    {/* Campos inferidos */}
                    {inferidos && (
                      <div className="col-12">
                        <div className="bg-light rounded p-3">
                          <p className="small fw-semibold text-muted mb-2">
                            <i className="bi bi-magic me-1"></i>
                            Campos generados automáticamente:
                          </p>
                          <div className="d-flex gap-2 flex-wrap">
                            <span className="badge bg-secondary fs-6 px-3 py-2">
                              Nivel {inferidos.nivel}
                            </span>
                            <span className={`badge bg-${inferidos.naturaleza==='D'?'info':'warning'} text-dark fs-6 px-3 py-2`}>
                              {NAT_LABEL[inferidos.naturaleza]}
                            </span>
                            <span className="badge bg-dark fs-6 px-3 py-2">
                              {TIPO_LABEL[inferidos.tipo_pgmd]}
                            </span>
                            <span className={`badge bg-${CLASE_COLOR[inferidos.clase_aptig]} fs-6 px-3 py-2`}>
                              {CLASE_LABEL[inferidos.clase_aptig]}
                            </span>
                            <span className={`badge fs-6 px-3 py-2 ${inferidos.es_detalle?'bg-success':'bg-secondary'}`}>
                              {inferidos.es_detalle ? '✓ Es detalle' : 'No es detalle'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hint inicial */}
                    {!inferidos && !editando && (
                      <div className="col-12">
                        <div className="alert alert-info border-0 py-2 small mb-0">
                          <i className="bi bi-lightbulb me-1"></i>
                          Ingrese el código y presione <kbd>Tab</kbd> — el sistema verificará
                          si existe y si su padre está creado, luego calculará todos los campos.
                          Longitudes válidas: <strong>1, 2, 4 ó 6 dígitos</strong>.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary"
                    onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success"
                    disabled={['existe','invalido','sin_padre'].includes(codigoEstado) || checking || !inferidos}>
                    <i className="bi bi-check2 me-1"></i>Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}