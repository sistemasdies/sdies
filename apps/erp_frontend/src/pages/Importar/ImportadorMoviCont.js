import { useState } from 'react';
import { importarMovimientos } from '../../api/asientos';
import toast from 'react-hot-toast';

// ── Orden exacto de columnas del CSV ──────────────────────────────────────
const COLUMNAS = [
  ['CodComprob',   'cod_comprob'],
  ['NumComprob',   'num_comprob'],
  ['ItemComprob',  'item_comprob'],
  ['Cuenta',       'cuenta'],
  ['DocRef',       'doc_ref'],
  ['Observacion',  'observacion'],
  ['Cedula',       'cedula'],
  ['CentroCosto',  'centro_costo'],
  ['DocSoporte',   'doc_soporte'],
  ['VrDebitos',    'vr_debitos'],
  ['VrCreditos',   'vr_creditos'],
  ['Fecha',        'fecha'],
];

// Nombres alternativos por campo — la columna se identifica por el nombre del
// encabezado (sin importar el orden ni si faltan columnas).
const ALIASES = {
  cod_comprob:   ['codcomprob', 'codcomprobante', 'comprobante'],
  num_comprob:   ['numcomprob', 'nocomprobante', 'numerocomprobante', 'numero'],
  item_comprob:  ['itemcomprob', 'item', 'linea', 'renglon'],
  cuenta:        ['cuenta', 'codigocuenta', 'codigodecuenta', 'cta'],
  doc_ref:       ['docref', 'docreferencia', 'referencia'],
  observacion:   ['observacion', 'observaciones', 'descripcion', 'concepto'],
  cedula:        ['cedula', 'nit', 'numerodeidentificacion', 'nrodocumento'],
  centro_costo:  ['centrocosto', 'centrodecosto', 'ccosto', 'centro'],
  doc_soporte:   ['docsoporte', 'documentosoporte', 'soporte'],
  vr_debitos:    ['vrdebitos', 'valordebitos', 'debitos', 'debito'],
  vr_creditos:   ['vrcreditos', 'valorcreditos', 'creditos', 'credito'],
  fecha:         ['fecha', 'fechacomprobante', 'fechamovimiento'],
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const MODOS = [
  { id: 'solo_nuevos', label: 'Solo nuevos',       desc: 'Omitir filas cuya clave ya exista' },
  { id: 'reemplazar',  label: 'Solo existentes',   desc: 'Actualizar solo filas ya existentes' },
  { id: 'ambos',       label: 'Nuevos + existentes', desc: 'Crear si no existe, actualizar si existe' },
];

const detectarSep = (linea) => {
  const t = (linea.match(/\t/g) || []).length;
  const c = (linea.match(/,/g)  || []).length;
  const s = (linea.match(/;/g)  || []).length;
  return t >= c && t >= s ? '\t' : s > c ? ';' : ',';
};

const parsearFecha = (valor) => {
  const t = String(valor || '').trim();
  if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};

export default function ImportadorMoviCont() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [modo,      setModo]      = useState('solo_nuevos');
  const [paso,      setPaso]      = useState(1);
  const [sepInfo,   setSepInfo]   = useState('');

  const parsear = (texto) => {
    const limpio = texto.replace(/^\uFEFF/, '').replace(/\r/g, '');
    const lineas = limpio.split('\n').filter(l => l.trim());
    if (lineas.length < 2) return { datos: [], errs: [], sep: ',' };

    const sep     = detectarSep(lineas[0]);
    const headers = lineas[0].split(sep).map(h => norm(h));

    // Mapear cada encabezado al campo cuyo alias coincida con la mayor longitud
    const idx       = {};
    const asignados = new Set();
    headers.forEach((h, i) => {
      let mejor = null, mejorLen = -1;
      Object.entries(ALIASES).forEach(([campo, aliases]) => {
        if (asignados.has(campo)) return;
        aliases.forEach(alias => {
          const an = norm(alias);
          if (an && h.includes(an) && an.length > mejorLen) {
            mejor = campo; mejorLen = an.length;
          }
        });
      });
      if (mejor) { idx[mejor] = i; asignados.add(mejor); }
    });

    const datos = [];
    const errs  = [];

    lineas.slice(1).forEach((linea, n) => {
      const vals = linea.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
      const get  = (campo) => (idx[campo] >= 0 ? vals[idx[campo]] || '' : '');

      const errFila = [];
      const cod   = get('cod_comprob');
      const num   = get('num_comprob');
      const item  = get('item_comprob');
      const cuenta = get('cuenta');
      const fecha = parsearFecha(get('fecha'));

      if (!cod)   errFila.push('Falta CodComprob');
      if (!cuenta) errFila.push('Falta Cuenta');
      if (num !== '' && !/^\d+$/.test(num))   errFila.push('NumComprob debe ser número');
      if (item !== '' && !/^\d+$/.test(item)) errFila.push('ItemComprob debe ser número');
      if (get('fecha') && !fecha) errFila.push('Fecha inválida (dd/mm/aaaa o aaaa-mm-dd)');

      const deb = get('vr_debitos');
      const cre = get('vr_creditos');
      const d   = parseFloat(deb);
      const c   = parseFloat(cre);
      if (deb !== '' && isNaN(d)) errFila.push('VrDebitos debe ser número');
      if (cre !== '' && isNaN(c)) errFila.push('VrCreditos debe ser número');

      datos.push({
        cod_comprob:   cod,
        num_comprob:   num || '',
        item_comprob:  item || '',
        cuenta:        cuenta,
        doc_ref:       get('doc_ref'),
        observacion:   get('observacion'),
        cedula:        get('cedula'),
        centro_costo:  get('centro_costo'),
        doc_soporte:   get('doc_soporte'),
        vr_debitos:    deb,
        vr_creditos:   cre,
        fecha,
        _fila:    n + 2,
        _errores: errFila,
        _valida:  errFila.length === 0,
      });
      if (errFila.length) errs.push({ fila: n + 2, errores: errFila });
    });

    return { datos, errs, sep };
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { datos, errs, sep } = parsear(ev.target.result);
      setFilas(datos); setErrores(errs);
      setSepInfo(sep === '\t' ? 'Tabulación' : sep === ';' ? 'Punto y coma' : 'Coma');
      setPaso(2);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const importar = async () => {
    const validas = filas.filter(f => f._valida);
    if (!validas.length) { toast.error('No hay filas válidas'); return; }

    setCargando(true);
    try {
      const r = await importarMovimientos({
        modo,
        registros: validas.map(f => ({
          cod_comprob:  f.cod_comprob,
          num_comprob:  f.num_comprob  === '' ? 0 : parseInt(f.num_comprob, 10),
          item_comprob: f.item_comprob === '' ? 0 : parseInt(f.item_comprob, 10),
          cuenta:       f.cuenta,
          doc_ref:      f.doc_ref,
          observacion:  f.observacion,
          cedula:       f.cedula || null,
          centro_costo: f.centro_costo || null,
          doc_soporte:  f.doc_soporte,
          vr_debitos:   f.vr_debitos === '' ? 0 : parseFloat(f.vr_debitos),
          vr_creditos:  f.vr_creditos === '' ? 0 : parseFloat(f.vr_creditos),
          fecha:        f.fecha,
        })),
      });
      setResultado(r.data);
      setPaso(3);
      if (r.data.creados || r.data.actualizados)
        toast.success(`${r.data.creados} creado(s), ${r.data.actualizados} actualizado(s)`);
      if (r.data.errores.length) toast.error(`${r.data.errores.length} con error`);
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(d || 'Error al importar');
    } finally { setCargando(false); }
  };

  const reiniciar = () => {
    setFilas([]); setErrores([]); setResultado(null);
    setSepInfo(''); setPaso(1); setModo('solo_nuevos');
  };

  const descargarPlantilla = () => {
    const csv = COLUMNAS.map(c => c[0]).join(',') + '\r\n'
      + 'RC,1,1,110505,Caja inicial,Arqueo de caja,1002345678,,,1000,0,15/01/2026\r\n'
      + 'RC,1,2,211505,Contrapartida,Arqueo de caja,,,,0,1000,15/01/2026\r\n';
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: 'plantilla_movicont.csv',
    });
    a.click();
  };

  const validas = filas.filter(f => f._valida).length;

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-journal-arrow-up me-2 text-success"></i>Importar Movimientos Contables (MoviCont)
        </span>
        <button className="btn btn-outline-secondary btn-sm" onClick={descargarPlantilla}>
          <i className="bi bi-download me-1"></i>Descargar plantilla
        </button>
      </div>

      <div className="card-body">

        {/* ── PASO 1 ── */}
        {paso === 1 && (
          <div>
            <div className="alert alert-info border-0 mb-4">
              <i className="bi bi-info-circle me-2"></i>
              Las columnas se identifican por el nombre del encabezado; el orden no importa.
            </div>

            <div className="table-responsive mb-4">
              <table className="table table-sm table-bordered">
                <thead className="table-light">
                  <tr>
                    {COLUMNAS.map(([nombre]) => (
                      <th key={nombre} className="small text-center">{nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {COLUMNAS.map(([, campo]) => (
                      <td key={campo} className="small text-muted text-center">
                        {campo === 'fecha' ? 'dd/mm/aaaa' : campo === 'cedula' || campo === 'centro_costo' ? 'opcional' : ''}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <ul className="list-unstyled small mb-4">
              {[
                'Separador: coma, tabulación o punto y coma',
                'Las columnas se identifican por el nombre del encabezado (no importa el orden)',
                'Obligatorias: CodComprob y Cuenta (identifican el movimiento)',
                'Campos faltantes en registros nuevos: texto → ".", número → 0, fecha → 1900-01-01',
                'Cuenta debe existir y ser de detalle; comprobante debe existir y estar activo',
                'Cedula y CentroCosto son opcionales (deben existir si se envían)',
                'Fecha aceptada: aaaa-mm-dd o dd/mm/aaaa',
                'Valores negativos en débito y crédito son permitidos',
                'Valores en cero (0,0) sí son válidos: forman parte del consecutivo',
                'La clave es CodComprob + NumComprob + ItemComprob',
              ].map(t => (
                <li key={t} className="d-flex align-items-start gap-2 mb-1">
                  <i className="bi bi-check-circle text-success flex-shrink-0 mt-1"></i>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="border rounded p-5 text-center"
              style={{ borderStyle: 'dashed', borderColor: '#dee2e6', cursor: 'pointer' }}
              onClick={() => document.getElementById('file-movicont').click()}>
              <i className="bi bi-cloud-upload display-3 text-success d-block mb-3"></i>
              <p className="mb-1 fw-semibold fs-5">Haz clic para seleccionar el archivo</p>
              <p className="text-muted small mb-0">CSV con las 12 columnas de MoviCont</p>
              <input type="file" id="file-movicont" accept=".csv,.txt,.tsv"
                className="d-none" onChange={onFileChange} />
            </div>
          </div>
        )}

        {/* ── PASO 2: previsualizar ── */}
        {paso === 2 && (
          <div>
            <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
              <span className="badge bg-success fs-6 py-2 px-3">✓ {validas} válidas</span>
              <span className="badge bg-danger fs-6 py-2 px-3">✗ {filas.length - validas} con errores</span>
              <span className="badge bg-secondary fs-6 py-2 px-3">{filas.length} total</span>
              <span className="badge bg-info text-dark fs-6 py-2 px-3">Separador: {sepInfo}</span>
            </div>

            <h6 className="fw-semibold mb-2">Modo de importación:</h6>
            <div className="d-flex gap-2 flex-wrap mb-3">
              {MODOS.map(m => (
                <button key={m.id}
                  className={`btn btn-sm ${modo === m.id ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setModo(m.id)} title={m.desc}>
                  {m.label}
                  <span className="d-block small text-muted">{m.desc}</span>
                </button>
              ))}
            </div>

            {errores.length > 0 && (
              <div className="alert alert-warning mb-3">
                <strong>Filas con errores (se omitirán):</strong>
                <ul className="mb-0 mt-2">
                  {errores.slice(0, 10).map(e => (
                    <li key={e.fila} className="small">
                      <strong>Fila {e.fila}:</strong> {e.errores.join(' | ')}
                    </li>
                  ))}
                  {errores.length > 10 && <li className="small text-muted">...y {errores.length - 10} más</li>}
                </ul>
              </div>
            )}

            <div className="table-responsive" style={{ maxHeight: 440 }}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-dark sticky-top">
                  <tr>
                    <th style={{ width: 45 }}>#</th>
                    <th style={{ width: 36 }}></th>
                    {COLUMNAS.map(([nombre]) => <th key={nombre} className="small">{nombre}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f._fila} className={!f._valida ? 'table-danger' : ''}>
                      <td className="text-muted small">{f._fila}</td>
                      <td>
                        {f._valida
                          ? <i className="bi bi-check-circle-fill text-success"></i>
                          : <i className="bi bi-x-circle-fill text-danger" title={f._errores.join(' | ')}></i>}
                      </td>
                      <td className="small"><code>{f.cod_comprob}</code></td>
                      <td className="small text-end">{f.num_comprob}</td>
                      <td className="small text-end">{f.item_comprob}</td>
                      <td className="small"><code>{f.cuenta}</code></td>
                      <td className="small">{f.doc_ref}</td>
                      <td className="small">{f.observacion}</td>
                      <td className="small">{f.cedula}</td>
                      <td className="small">{f.centro_costo}</td>
                      <td className="small">{f.doc_soporte}</td>
                      <td className="small text-end">{f.vr_debitos}</td>
                      <td className="small text-end">{f.vr_creditos}</td>
                      <td className="small">{f.fecha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex gap-2 mt-3 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={reiniciar} disabled={cargando}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-success px-4" onClick={importar} disabled={cargando || !validas}>
                {cargando
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Importando...</>
                  : <><i className="bi bi-upload me-1"></i>Importar {validas} líneas</>}
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: resultado ── */}
        {paso === 3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                { label: 'Creadas',     value: resultado.creados,     color: 'success' },
                { label: 'Actualizadas', value: resultado.actualizados, color: 'primary' },
                { label: 'Omitidas',    value: resultado.omitidos,    color: 'secondary' },
                { label: 'Con errores', value: resultado.errores.length, color: 'danger' },
              ].map(k => (
                <div key={k.label} className="col-md-3">
                  <div className={`card border-0 bg-${k.color} text-white text-center p-4`}>
                    <div className="display-4 fw-bold">{k.value}</div>
                    <div className="mt-1">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {resultado.errores.length > 0 && (
              <div className="alert alert-danger">
                <strong>Errores:</strong>
                <div className="table-responsive mt-2">
                  <table className="table table-sm mb-0 bg-white">
                    <thead className="table-light">
                      <tr><th>Fila</th><th>Referencia</th><th>Error</th></tr>
                    </thead>
                    <tbody>
                      {resultado.errores.map((e, i) => (
                        <tr key={i}>
                          <td className="small">{e.fila}</td>
                          <td><code className="small">{e.referencia}</code></td>
                          <td className="small text-danger">{e.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="text-center mt-4">
              <button className="btn btn-success btn-lg px-5" onClick={reiniciar}>
                <i className="bi bi-arrow-repeat me-1"></i>Nueva importación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
