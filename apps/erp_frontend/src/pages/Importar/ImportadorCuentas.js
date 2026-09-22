import { useState } from 'react';
import { createCuenta, getCuentas, updateCuenta } from '../../api/cuentas';
import toast from 'react-hot-toast';

// ── Reglas de inferencia (sin padre — lo calcula el backend) ─────────────
const inferirCampos = (codigo) => {
  const n     = codigo.trim().length;
  const inicio= codigo.trim()[0];

  // Solo longitudes 1, 2, 4, 6
  const nivel      = n === 1 ? '1' : n === 2 ? '2' : n === 4 ? '3' : '4';
  const tipo_pgmd  = n === 1 ? 'P' : n === 2 ? 'G' : n === 4 ? 'M' : 'D';
  const naturaleza = ['1','5'].includes(inicio) ? 'D' : 'C';
  const clase_aptig= {'1':'A','2':'P','3':'T','4':'I','5':'G'}[inicio] || 'A';
  const es_detalle = n === 6;

  return { nivel, naturaleza, tipo_pgmd, clase_aptig, es_detalle };
};

const CLASE_COLOR = { A:'success', P:'danger', T:'warning', I:'info', G:'secondary' };
const CLASE_LABEL = { A:'Activo', P:'Pasivo', T:'Patrimonio', I:'Ingreso', G:'Gasto' };

const extraerError = (err) => {
  const data = err?.response?.data;
  if (!data) return 'Error de conexión';
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) return data.detail[0];
  const primera = Object.values(data)[0];
  if (Array.isArray(primera)) return primera[0];
  if (typeof primera === 'string') return primera;
  return JSON.stringify(data);
};

const detectarSep = (linea) => {
  const t = (linea.match(/\t/g)||[]).length;
  const c = (linea.match(/,/g) ||[]).length;
  const s = (linea.match(/;/g) ||[]).length;
  return t >= c && t >= s ? '\t' : s > c ? ';' : ',';
};

// Padre por lógica pura — sin buscar en BD
const padreDesdecodigo = (codigo) => {
  const n = codigo.trim().length;
  if (n === 1) return '(raíz)';
  if (n === 2) return codigo.substring(0, 1);
  if (n === 4) return codigo.substring(0, 2);
  if (n === 6) return codigo.substring(0, 4);
  return '(raíz)';
};

export default function ImportadorCuentas() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [progreso,  setProgreso]  = useState(0);
  const [paso,      setPaso]      = useState(1);
  const [sepInfo,   setSepInfo]   = useState('');

  // ── Parser ────────────────────────────────────────────────────────────
  const parsear = (texto) => {
    const limpio  = texto.replace(/^\uFEFF/, '').replace(/\r/g, '');
    const lineas  = limpio.split('\n').filter(l => l.trim());
    if (lineas.length < 2) return { datos: [], errs: [], sep: ',' };

    const sep     = detectarSep(lineas[0]);
    const headers = lineas[0].split(sep).map(h => h.trim().toLowerCase());
    const iCod    = headers.findIndex(h => h.includes('cod'));
    const iDesc   = headers.findIndex(h => h.includes('desc') || h.includes('nomb'));

    const datos = [];
    const errs  = [];

    lineas.slice(1).forEach((linea, idx) => {
      if (!linea.trim()) return;
      const vals    = linea.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
      const codigo  = (iCod  >= 0 ? vals[iCod]  : vals[0] || '').trim();
      const desc    = (iDesc >= 0 ? vals[iDesc]  : vals[1] || '').trim();

      const errFila = [];
      if (!codigo) errFila.push('Falta código');
      if (!desc)   errFila.push('Falta descripción');
      if (codigo && !/^\d+$/.test(codigo))
        errFila.push('El código debe ser numérico');
      if (codigo && ![1,2,4,6].includes(codigo.length))
        errFila.push(`Longitud inválida (${codigo.length} dígitos) — se esperan 1, 2, 4 ó 6`);

      const campos = (codigo && !errFila.length) ? inferirCampos(codigo) : {};

      datos.push({
        codigo, descripcion: desc, ...campos,
        _padre:   codigo ? padreDesdecodigo(codigo) : '—',
        _fila:    idx + 2,
        _errores: errFila,
        _valida:  errFila.length === 0,
      });
      if (errFila.length) errs.push({ fila: idx + 2, errores: errFila });
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
      setSepInfo(sep==='\t'?'Tabulación':sep===';'?'Punto y coma':'Coma');
      setPaso(2);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // ── Importar ─────────────────────────────────────────────────────────
  const importar = async () => {
    const validas = filas.filter(f => f._valida);
    if (!validas.length) { toast.error('No hay filas válidas'); return; }

    setCargando(true);
    setProgreso(0);

    // Cargar códigos existentes en BD
    let codigosEnBD = new Map();
    try {
      const res  = await getCuentas({ page_size: 10000 });
      const list = res.data.results || res.data;
      list.forEach(c => codigosEnBD.set(c.codigo, c.id));
    } catch {
      toast.error('No se pudo cargar el plan de cuentas');
      setCargando(false);
      return;
    }

    // Ordenar: primero 1 dígito, luego 2, luego 4, luego 6
    // así el padre siempre existe antes que el hijo
    const ordenadas = [...validas].sort((a, b) => a.codigo.length - b.codigo.length);

    let creadas = 0, actualizadas = 0, fail = 0;
    const erroresImport = [];

    for (let i = 0; i < ordenadas.length; i++) {
      const fila = ordenadas[i];
      setProgreso(Math.round(((i + 1) / ordenadas.length) * 100));

      // El backend calcula el padre en save() — solo enviamos los datos básicos
      const payload = {
        codigo:      fila.codigo,
        descripcion: fila.descripcion,
        nivel:       fila.nivel,
        naturaleza:  fila.naturaleza,
        tipo_pgmd:   fila.tipo_pgmd,
        es_detalle:  fila.es_detalle,
        // clase_aptig y padre los infiere el backend en save()
      };

      try {
        if (codigosEnBD.has(fila.codigo)) {
          await updateCuenta(codigosEnBD.get(fila.codigo), payload);
          actualizadas++;
        } else {
          await createCuenta(payload);
          creadas++;
        }
      } catch (err) {
        fail++;
        erroresImport.push({
          fila:   fila._fila,
          codigo: fila.codigo,
          padre:  fila._padre,
          error:  extraerError(err),
        });
      }
    }

    setCargando(false);
    setProgreso(100);
    setResultado({ creadas, actualizadas, fail, erroresImport });
    setPaso(3);
    if (creadas || actualizadas)
      toast.success(`${creadas} creada(s), ${actualizadas} actualizada(s)`);
    if (fail) toast.error(`${fail} con error`);
  };

  const reiniciar = () => {
    setFilas([]); setErrores([]); setResultado(null);
    setProgreso(0); setSepInfo(''); setPaso(1);
  };

  const descargarPlantilla = () => {
    const csv = 'codigo,descripcion\r\n'
      + '1,ACTIVOS\r\n11,ACTIVOS DISPONIBLES\r\n1105,CAJA Y BANCOS\r\n'
      + '110505,Caja general\r\n110510,Cajas menores\r\n'
      + '2,PASIVOS\r\n21,OBLIGACIONES FINANCIERAS\r\n'
      + '3,PATRIMONIO\r\n4,INGRESOS\r\n5,GASTOS\r\n';
    const a  = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'})),
      download: 'plantilla_cuentas.csv',
    });
    a.click();
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-diagram-3 me-2 text-success"></i>Importar Plan de Cuentas
        </span>
        <button className="btn btn-outline-secondary btn-sm" onClick={descargarPlantilla}>
          <i className="bi bi-download me-1"></i>Descargar plantilla
        </button>
      </div>

      <div className="card-body">

        {/* ── PASO 1 ── */}
        {paso === 1 && (
          <div>
            <div className="alert alert-success border-0 mb-4">
              <i className="bi bi-magic me-2"></i>
              <strong>Solo 2 columnas: <code>codigo</code> y <code>descripcion</code>.</strong>
              {' '}El sistema genera todos los demás campos automáticamente.
              Si el código ya existe, sobreescribe la descripción.
            </div>

            <div className="row g-4 mb-4">
              <div className="col-md-6">
                <h6 className="fw-semibold mb-3">Longitudes de código aceptadas:</h6>
                <table className="table table-sm table-bordered">
                  <thead className="table-light">
                    <tr><th>Dígitos</th><th>Nivel</th><th>tipo_pgmd</th><th>es_detalle</th><th>Padre</th></tr>
                  </thead>
                  <tbody>
                    <tr><td><code>1</code></td><td>1</td><td>P</td><td>No</td><td>—</td></tr>
                    <tr><td><code>2</code></td><td>2</td><td>G</td><td>No</td><td>1er dígito</td></tr>
                    <tr><td><code>4</code></td><td>3</td><td>M</td><td>No</td><td>2 primeros</td></tr>
                    <tr><td><code>6</code></td><td>4</td><td>D</td><td><strong>Sí</strong></td><td>4 primeros</td></tr>
                  </tbody>
                </table>

                <h6 className="fw-semibold mb-2 mt-3">Primer dígito:</h6>
                <div className="d-flex gap-2 flex-wrap">
                  {Object.entries(CLASE_LABEL).map(([k,v]) => (
                    <span key={k} className={`badge bg-${CLASE_COLOR[k]} fs-6 px-3 py-2`}>
                      {k} = {v}
                    </span>
                  ))}
                </div>
                <div className="mt-2 small text-muted">
                  1,5 → Naturaleza D &nbsp;|&nbsp; 2,3,4 → Naturaleza C
                </div>
              </div>

              <div className="col-md-6">
                <h6 className="fw-semibold mb-2">Ejemplo de archivo:</h6>
                <div className="bg-light rounded p-3 font-monospace small">
                  <div className="text-muted mb-1">codigo,descripcion</div>
                  <div>1,ACTIVOS</div>
                  <div>11,ACTIVOS DISPONIBLES</div>
                  <div>1105,CAJA Y BANCOS</div>
                  <div>110505,Caja general</div>
                  <div>2,PASIVOS</div>
                  <div>21,OBLIGACIONES FINANCIERAS</div>
                </div>
                <ul className="list-unstyled mt-3 small">
                  {['Separador: coma, tabulación o punto y coma',
                    'Codigos numéricos de 1, 2, 4 ó 6 dígitos',
                    'El padre se calcula automáticamente del código',
                    'Si el código ya existe → actualiza la descripción',
                    'Codigos 3 y 5 dígitos no son válidos'].map(t => (
                    <li key={t} className="d-flex align-items-start gap-2 mb-1">
                      <i className={`bi ${t.includes('no son válidos')?'bi-x-circle text-danger':'bi-check-circle text-success'} flex-shrink-0 mt-1`}></i>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border rounded p-5 text-center"
              style={{borderStyle:'dashed', borderColor:'#dee2e6', cursor:'pointer'}}
              onClick={() => document.getElementById('file-cuentas').click()}>
              <i className="bi bi-cloud-upload display-3 text-success d-block mb-3"></i>
              <p className="mb-1 fw-semibold fs-5">Haz clic para seleccionar el archivo</p>
              <p className="text-muted small mb-0">CSV — solo codigo y descripcion</p>
              <input type="file" id="file-cuentas" accept=".csv,.txt,.tsv"
                className="d-none" onChange={onFileChange} />
            </div>
          </div>
        )}

        {/* ── PASO 2: previsualizar ── */}
        {paso === 2 && (
          <div>
            <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
              <span className="badge bg-success fs-6 py-2 px-3">
                ✓ {filas.filter(f=>f._valida).length} válidas
              </span>
              <span className="badge bg-danger fs-6 py-2 px-3">
                ✗ {filas.filter(f=>!f._valida).length} con errores
              </span>
              <span className="badge bg-secondary fs-6 py-2 px-3">
                {filas.length} total
              </span>
              <span className="badge bg-info text-dark fs-6 py-2 px-3">
                Separador: {sepInfo}
              </span>
            </div>

            {errores.length > 0 && (
              <div className="alert alert-warning mb-3">
                <strong>Filas con errores (se omitirán):</strong>
                <ul className="mb-0 mt-2">
                  {errores.slice(0,10).map(e=>(
                    <li key={e.fila} className="small">
                      <strong>Fila {e.fila}:</strong> {e.errores.join(' | ')}
                    </li>
                  ))}
                  {errores.length>10 && <li className="small text-muted">...y {errores.length-10} más</li>}
                </ul>
              </div>
            )}

            <div className="table-responsive" style={{maxHeight:440}}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-dark sticky-top">
                  <tr>
                    <th style={{width:45}}>#</th>
                    <th style={{width:36}}></th>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th className="text-center">Niv.</th>
                    <th className="text-center">Nat.</th>
                    <th className="text-center">Tipo</th>
                    <th className="text-center">Clase</th>
                    <th className="text-center">Det.</th>
                    <th>Padre calculado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f=>(
                    <tr key={f._fila} className={!f._valida?'table-danger':''}>
                      <td className="text-muted small">{f._fila}</td>
                      <td>
                        {f._valida
                          ?<i className="bi bi-check-circle-fill text-success"></i>
                          :<i className="bi bi-x-circle-fill text-danger"
                              title={f._errores.join(' | ')}></i>}
                      </td>
                      <td><code className="fw-bold">{f.codigo}</code></td>
                      <td className="small">{f.descripcion}</td>
                      <td className="text-center"><span className="badge bg-secondary">{f.nivel}</span></td>
                      <td className="text-center">
                        <span className={`badge bg-${f.naturaleza==='D'?'info':'warning'} text-dark`}>
                          {f.naturaleza}
                        </span>
                      </td>
                      <td className="text-center small fw-semibold">{f.tipo_pgmd}</td>
                      <td className="text-center">
                        <span className={`badge bg-${CLASE_COLOR[f.clase_aptig]||'dark'}`}
                          title={CLASE_LABEL[f.clase_aptig]}>
                          {f.clase_aptig}
                        </span>
                      </td>
                      <td className="text-center">
                        {f.es_detalle
                          ?<i className="bi bi-check-lg text-success fw-bold"></i>
                          :<i className="bi bi-dash text-muted"></i>}
                      </td>
                      <td>
                        {f._padre==='(raíz)'
                          ?<span className="badge bg-dark">raíz</span>
                          :<code className="small text-success">{f._padre}</code>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {cargando && (
              <div className="mt-3">
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Importando...</span><span>{progreso}%</span>
                </div>
                <div className="progress" style={{height:8}}>
                  <div className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                    style={{width:`${progreso}%`}}></div>
                </div>
              </div>
            )}

            <div className="d-flex gap-2 mt-3 justify-content-end">
              <button className="btn btn-outline-secondary"
                onClick={reiniciar} disabled={cargando}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-success px-4" onClick={importar}
                disabled={cargando || !filas.filter(f=>f._valida).length}>
                {cargando
                  ?<><span className="spinner-border spinner-border-sm me-1"></span>
                    Importando {progreso}%...</>
                  :<><i className="bi bi-upload me-1"></i>
                    Importar {filas.filter(f=>f._valida).length} cuentas</>}
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: resultado ── */}
        {paso === 3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                {label:'Cuentas creadas',     value:resultado.creadas,     color:'success'},
                {label:'Cuentas actualizadas',value:resultado.actualizadas,color:'primary'},
                {label:'Con errores',          value:resultado.fail,        color:'danger' },
              ].map(k=>(
                <div key={k.label} className="col-md-4">
                  <div className={`card border-0 bg-${k.color} text-white text-center p-4`}>
                    <div className="display-4 fw-bold">{k.value}</div>
                    <div className="mt-1">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {resultado.erroresImport.length > 0 && (
              <div className="alert alert-danger">
                <strong>Errores:</strong>
                <div className="table-responsive mt-2">
                  <table className="table table-sm mb-0 bg-white">
                    <thead className="table-light">
                      <tr><th>Fila</th><th>Código</th><th>Padre</th><th>Error</th></tr>
                    </thead>
                    <tbody>
                      {resultado.erroresImport.map((e,i)=>(
                        <tr key={i}>
                          <td className="small">{e.fila}</td>
                          <td><code className="small">{e.codigo}</code></td>
                          <td><code className="small text-muted">{e.padre}</code></td>
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