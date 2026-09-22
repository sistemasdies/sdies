import { useState } from 'react';
import API from '../../api/client';
import toast from 'react-hot-toast';

const crearPlantilla    = (data)    => API.post('/plantillas/', data);
const actualizarPlantilla = (id, data) => API.put(`/plantillas/${id}/`, data);
const getPlantillas     = ()        => API.get('/plantillas/?page_size=1000');
const getComprobantes   = ()        => API.get('/comprobantes/?page_size=1000');

const PLANTILLA_CSV = `cod_plantilla,nombre,descripcion,comprobante
NOM001,Nómina mensual,Registro de nómina del mes,CC
VTA001,Ventas del período,Asiento de ventas,CI
GAS001,Gastos generales,Registro de gastos,CE`;

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

export default function ImportadorPlantillas() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [progreso,  setProgreso]  = useState(0);
  const [paso,      setPaso]      = useState(1);
  const [sepInfo,   setSepInfo]   = useState('');

  const parsear = (texto) => {
    const limpio  = texto.replace(/^\uFEFF/, '').replace(/\r/g, '');
    const lineas  = limpio.split('\n').filter(l => l.trim());
    if (lineas.length < 2) return { datos: [], errs: [], sep: ',' };

    const sep     = detectarSep(lineas[0]);
    const headers = lineas[0].split(sep).map(h => h.trim().toLowerCase()
      .replace('ó','o').replace('ó','o'));

    // Detectar índices flexiblemente
    const iCod  = headers.findIndex(h => h.includes('cod') && h.includes('plant'));
    const iNom  = headers.findIndex(h => h.includes('nom'));
    const iDesc = headers.findIndex(h => h.includes('desc'));
    const iComp = headers.findIndex(h => h.includes('comp'));

    const datos = [];
    const errs  = [];

    lineas.slice(1).forEach((linea, idx) => {
      if (!linea.trim()) return;
      const vals = linea.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));

      const cod_plantilla = (iCod  >= 0 ? vals[iCod]  : vals[0] || '').trim();
      const nombre        = (iNom  >= 0 ? vals[iNom]  : vals[1] || '').trim();
      const descripcion   = (iDesc >= 0 ? vals[iDesc] : vals[2] || '').trim();
      const comprobante   = (iComp >= 0 ? vals[iComp] : vals[3] || '').trim();

      const errFila = [];
      if (!cod_plantilla)           errFila.push('Falta código de plantilla');
      if (cod_plantilla.length > 7) errFila.push('Código máx 7 caracteres');
      if (!nombre)                  errFila.push('Falta nombre');
      if (nombre.length > 25)       errFila.push('Nombre máx 25 caracteres');
      if (descripcion.length > 100) errFila.push('Descripción máx 100 caracteres');

      datos.push({
        cod_plantilla, nombre, descripcion, comprobante,
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

  const importar = async () => {
    const validas = filas.filter(f => f._valida);
    if (!validas.length) { toast.error('No hay filas válidas'); return; }

    setCargando(true);
    setProgreso(0);

    // Cargar plantillas y comprobantes existentes
    let plantillasExist = {}, comprobantesExist = {};
    try {
      const [pRes, cRes] = await Promise.all([getPlantillas(), getComprobantes()]);
      (pRes.data.results || pRes.data).forEach(p => {
        plantillasExist[p.cod_plantilla] = p.id;
      });
      (cRes.data.results || cRes.data).forEach(c => {
        comprobantesExist[c.codigo] = c.id;
      });
    } catch {
      toast.error('Error al cargar datos existentes');
      setCargando(false);
      return;
    }

    let creadas = 0, actualizadas = 0, fail = 0;
    const erroresImport = [];

    for (let i = 0; i < validas.length; i++) {
      const f = validas[i];
      setProgreso(Math.round(((i + 1) / validas.length) * 100));

      // Validar comprobante si viene en el CSV
      if (f.comprobante && !comprobantesExist[f.comprobante]) {
        fail++;
        erroresImport.push({
          fila: f._fila, cod: f.cod_plantilla,
          error: `Comprobante "${f.comprobante}" no existe en la tabla de comprobantes`,
        });
        continue;
      }

      const payload = {
        cod_plantilla: f.cod_plantilla,
        nombre:        f.nombre,
        descripcion:   f.descripcion || '',
        comprobante:   f.comprobante || null,
      };

      try {
        if (plantillasExist[f.cod_plantilla]) {
          await actualizarPlantilla(plantillasExist[f.cod_plantilla], payload);
          actualizadas++;
        } else {
          await crearPlantilla(payload);
          creadas++;
        }
      } catch (err) {
        fail++;
        erroresImport.push({
          fila: f._fila, cod: f.cod_plantilla,
          error: extraerError(err),
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
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([PLANTILLA_CSV], {type:'text/csv;charset=utf-8;'})),
      download: 'plantilla_encabezados.csv',
    });
    a.click();
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-journals me-2 text-success"></i>
          Importar Encabezados de Plantillas
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
              <i className="bi bi-info-circle me-2"></i>
              Importa los <strong>encabezados</strong> de plantillas contables.
              Si el código ya existe, <strong>actualiza</strong> el nombre y descripción.
            </div>

            <div className="row g-4 mb-4">
              <div className="col-md-6">
                <h6 className="fw-semibold mb-2">Columnas del archivo:</h6>
                <table className="table table-sm table-bordered">
                  <thead className="table-light">
                    <tr><th>Columna</th><th>Req.</th><th>Máx.</th><th>Descripción</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>cod_plantilla</code></td>
                      <td><span className="badge bg-danger">Sí</span></td>
                      <td>7</td>
                      <td className="small">Código único</td>
                    </tr>
                    <tr>
                      <td><code>nombre</code></td>
                      <td><span className="badge bg-danger">Sí</span></td>
                      <td>25</td>
                      <td className="small">Nombre de la plantilla</td>
                    </tr>
                    <tr>
                      <td><code>descripcion</code></td>
                      <td><span className="badge bg-secondary">No</span></td>
                      <td>100</td>
                      <td className="small">Descripción opcional</td>
                    </tr>
                    <tr>
                      <td><code>comprobante</code></td>
                      <td><span className="badge bg-secondary">No</span></td>
                      <td>7</td>
                      <td className="small">Código del comprobante (debe existir)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="col-md-6">
                <h6 className="fw-semibold mb-2">Ejemplo:</h6>
                <div className="bg-light rounded p-3 font-monospace small">
                  <div className="text-muted mb-1">cod_plantilla,nombre,descripcion,comprobante</div>
                  <div>NOM001,Nómina mensual,Registro nómina,CC</div>
                  <div>VTA001,Ventas período,,CI</div>
                  <div>GAS001,Gastos generales,Gastos admin,CE</div>
                </div>
                <ul className="list-unstyled mt-3 small">
                  {[
                    'Separador: coma, tabulación o punto y coma',
                    'Si el código existe → actualiza nombre y descripción',
                    'El comprobante debe existir previamente en el sistema',
                    'Comprobante vacío → queda sin comprobante predeterminado',
                  ].map(t => (
                    <li key={t} className="d-flex align-items-start gap-2 mb-1">
                      <i className="bi bi-check-circle text-success flex-shrink-0 mt-1"></i>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border rounded p-5 text-center"
              style={{borderStyle:'dashed', borderColor:'#dee2e6', cursor:'pointer'}}
              onClick={() => document.getElementById('file-plantillas').click()}>
              <i className="bi bi-cloud-upload display-3 text-success d-block mb-3"></i>
              <p className="mb-1 fw-semibold fs-5">Haz clic para seleccionar el archivo</p>
              <p className="text-muted small mb-0">CSV — separador automático</p>
              <input type="file" id="file-plantillas" accept=".csv,.txt,.tsv"
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
                  {errores.slice(0,10).map(e => (
                    <li key={e.fila} className="small">
                      <strong>Fila {e.fila}:</strong> {e.errores.join(' | ')}
                    </li>
                  ))}
                  {errores.length > 10 &&
                    <li className="small text-muted">...y {errores.length-10} más</li>}
                </ul>
              </div>
            )}

            <div className="table-responsive" style={{maxHeight:420}}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-dark sticky-top">
                  <tr>
                    <th style={{width:45}}>#</th>
                    <th style={{width:36}}></th>
                    <th style={{width:100}}>Código</th>
                    <th style={{width:200}}>Nombre</th>
                    <th>Descripción</th>
                    <th style={{width:110}}>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f._fila} className={!f._valida?'table-danger':''}>
                      <td className="text-muted small">{f._fila}</td>
                      <td>
                        {f._valida
                          ? <i className="bi bi-check-circle-fill text-success"></i>
                          : <i className="bi bi-x-circle-fill text-danger"
                               title={f._errores.join(' | ')}></i>}
                      </td>
                      <td><code className="fw-bold">{f.cod_plantilla}</code></td>
                      <td className="small">{f.nombre}</td>
                      <td className="small text-muted">
                        {f.descripcion || <span className="fst-italic">—</span>}
                      </td>
                      <td className="text-center">
                        {f.comprobante
                          ? <span className="badge bg-info text-dark">{f.comprobante}</span>
                          : <span className="text-muted">—</span>}
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
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>
                      Importando {progreso}%...</>
                  : <><i className="bi bi-upload me-1"></i>
                      Importar {filas.filter(f=>f._valida).length} plantillas</>}
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: resultado ── */}
        {paso === 3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                {label:'Creadas',      value:resultado.creadas,     color:'success'},
                {label:'Actualizadas', value:resultado.actualizadas,color:'primary'},
                {label:'Con error',    value:resultado.fail,        color:'danger' },
              ].map(k => (
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
                      <tr><th>Fila</th><th>Código</th><th>Error</th></tr>
                    </thead>
                    <tbody>
                      {resultado.erroresImport.map((e,i) => (
                        <tr key={i}>
                          <td className="small">{e.fila}</td>
                          <td><code className="small">{e.cod}</code></td>
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
