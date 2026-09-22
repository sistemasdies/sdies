import { useState } from 'react';
import { createComprobante, updateComprobante, getComprobantes } from '../../api/comprobantes';
import toast from 'react-hot-toast';

const PLANTILLA_CSV = `codigo,descripcion,numero_inicial,activo
CC,Comprobante de Contabilidad,1,true
CE,Comprobante de Egreso,1,true
CI,Comprobante de Ingreso,1,true
ND,Nota Débito,1,true
NC,Nota Crédito,1,true`;

const extraerError = (err) => {
  const data = err?.response?.data;
  if (!data) return 'Error de conexión';
  if (data.traceback) {
    // Mostrar la última línea del traceback que tiene el error real
    const lineas = data.traceback.split('\n').filter(l => l.trim());
    const ultimaLinea = lineas[lineas.length - 1];
    return ultimaLinea || data.detail || 'Error interno';
  }
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) return data.detail[0];
  const primera = Object.values(data)[0];
  if (Array.isArray(primera)) return primera[0];
  if (typeof primera === 'string') return primera;
  return JSON.stringify(data);
};

export default function ImportadorComprobantes() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [paso,      setPaso]      = useState(1);

  const parsearCSV = (texto) => {
    const limpio  = texto.replace(/^\uFEFF/,'').replace(/\r/g,'');
    const lineas  = limpio.split('\n').filter(l => l.trim());
    const sep     = (lineas[0].match(/\t/g)||[]).length >= (lineas[0].match(/,/g)||[]).length ? '\t' : ',';
    const headers = lineas[0].split(sep).map(h => h.trim().toLowerCase());
    const datos   = [];
    const errs    = [];

    lineas.slice(1).forEach((linea, idx) => {
      if (!linea.trim()) return;
      const vals = linea.split(sep).map(v => v.trim().replace(/"/g,''));
      const fila = {};
      headers.forEach((h, i) => { fila[h] = vals[i] || ''; });

      const errFila = [];
      if (!fila.codigo)      errFila.push('Falta código');
      if (!fila.descripcion) errFila.push('Falta descripción');
      if (fila.codigo && fila.codigo.length > 7) errFila.push('Código máx 7 caracteres');

      fila._fila    = idx + 2;
      fila._errores = errFila;
      fila._valida  = errFila.length === 0;
      datos.push(fila);
      if (errFila.length) errs.push({ fila: idx + 2, errores: errFila });
    });
    return { datos, errs };
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { datos, errs } = parsearCSV(ev.target.result);
      setFilas(datos); setErrores(errs); setPaso(2);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const importar = async () => {
    const validas = filas.filter(f => f._valida);
    if (!validas.length) { toast.error('No hay filas válidas'); return; }
    setCargando(true);

    // Cargar comprobantes existentes en BD
    let existentes = {};
    try {
      const res = await getComprobantes();
      const list = res.data.results || res.data;
      list.forEach(c => { existentes[c.codigo] = c.id; });
    } catch { toast.error('No se pudo cargar comprobantes existentes'); setCargando(false); return; }

    let creados = 0, actualizados = 0, fail = 0, erroresImport = [];
    for (const f of validas) {
      const payload = {
        codigo:         f.codigo.trim(),
        descripcion:    f.descripcion,
        numero_inicial: f.numero_inicial ? parseInt(f.numero_inicial) : 1,
        activo:         f.activo !== 'false' && f.activo !== '0',
      };
      try {
        if (existentes[payload.codigo]) {
          await updateComprobante(existentes[payload.codigo], payload);
          actualizados++;
        } else {
          await createComprobante(payload);
          creados++;
        }
      } catch (err) {
        fail++;
        erroresImport.push({ fila: f._fila, codigo: f.codigo, error: extraerError(err) });
      }
    }
    setCargando(false);
    setResultado({ creados, actualizados, fail, erroresImport });
    setPaso(3);
    if (creados || actualizados)
      toast.success(`${creados} creado(s), ${actualizados} actualizado(s)`);
    if (fail) toast.error(`${fail} con error`);
  };

  const reiniciar = () => { setFilas([]); setErrores([]); setResultado(null); setPaso(1); };

  const descargarPlantilla = () => {
    const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'plantilla_comprobantes.csv'; a.click();
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-receipt me-2 text-info"></i>Importar Comprobantes
        </span>
        <button className="btn btn-outline-secondary btn-sm" onClick={descargarPlantilla}>
          <i className="bi bi-download me-1"></i>Descargar plantilla
        </button>
      </div>
      <div className="card-body">

        {paso === 1 && (
          <div>
            <div className="alert alert-info border-0 mb-4">
              <i className="bi bi-info-circle me-2"></i>
              Importa los tipos de comprobante contable desde un CSV con 4 columnas.
            </div>
            <table className="table table-sm table-bordered mb-4" style={{maxWidth:500}}>
              <thead className="table-light">
                <tr><th>Columna</th><th>Requerida</th><th>Descripción</th></tr>
              </thead>
              <tbody>
                <tr><td><code>codigo</code></td><td><span className="badge bg-danger">Sí</span></td><td>Máx 7 caracteres (CC, CE...)</td></tr>
                <tr><td><code>descripcion</code></td><td><span className="badge bg-danger">Sí</span></td><td>Nombre del comprobante</td></tr>
                <tr><td><code>numero_inicial</code></td><td><span className="badge bg-secondary">No</span></td><td>Consecutivo inicial (default: 1)</td></tr>
                <tr><td><code>activo</code></td><td><span className="badge bg-secondary">No</span></td><td>true / false (default: true)</td></tr>
              </tbody>
            </table>
            <div className="border rounded p-5 text-center"
              style={{borderStyle:'dashed',cursor:'pointer'}}
              onClick={()=>document.getElementById('file-comp').click()}>
              <i className="bi bi-cloud-upload display-4 text-muted d-block mb-2"></i>
              <p className="mb-1 fw-semibold">Haz clic para seleccionar el CSV</p>
              <input type="file" id="file-comp" accept=".csv,.txt" className="d-none" onChange={onFileChange}/>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div>
            <div className="d-flex gap-3 mb-3">
              <span className="badge bg-success fs-6">{filas.filter(f=>f._valida).length} válidas</span>
              <span className="badge bg-danger fs-6">{filas.filter(f=>!f._valida).length} con errores</span>
            </div>
            {errores.length > 0 && (
              <div className="alert alert-warning mb-3">
                <strong>Filas con errores:</strong>
                <ul className="mb-0 mt-1">
                  {errores.map(e=><li key={e.fila} className="small">Fila {e.fila}: {e.errores.join(', ')}</li>)}
                </ul>
              </div>
            )}
            <div className="table-responsive" style={{maxHeight:360}}>
              <table className="table table-sm table-hover">
                <thead className="table-dark sticky-top">
                  <tr><th>#</th><th></th><th>Código</th><th>Descripción</th><th>Nº inicial</th><th>Activo</th></tr>
                </thead>
                <tbody>
                  {filas.map(f=>(
                    <tr key={f._fila} className={!f._valida?'table-danger':''}>
                      <td className="small text-muted">{f._fila}</td>
                      <td>{f._valida
                        ?<i className="bi bi-check-circle-fill text-success"></i>
                        :<i className="bi bi-x-circle-fill text-danger" title={f._errores.join(', ')}></i>}
                      </td>
                      <td><code>{f.codigo}</code></td>
                      <td className="small">{f.descripcion}</td>
                      <td className="small">{f.numero_inicial||'1'}</td>
                      <td className="text-center">
                        {f.activo!=='false'&&f.activo!=='0'
                          ?<span className="badge bg-success">Sí</span>
                          :<span className="badge bg-secondary">No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex gap-2 mt-3 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={reiniciar}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-info text-white" onClick={importar}
                disabled={cargando||!filas.filter(f=>f._valida).length}>
                {cargando
                  ?<><span className="spinner-border spinner-border-sm me-1"></span>Importando...</>
                  :<><i className="bi bi-upload me-1"></i>Importar {filas.filter(f=>f._valida).length} comprobantes</>}
              </button>
            </div>
          </div>
        )}

        {paso === 3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                {label:'Creados',      value:resultado.creados,     color:'success'},
                {label:'Actualizados', value:resultado.actualizados,color:'primary'},
                {label:'Con error',    value:resultado.fail,        color:'danger' },
              ].map(k=>(
                <div key={k.label} className="col-md-6">
                  <div className={`card border-0 bg-${k.color} text-white text-center p-4`}>
                    <div className="display-4 fw-bold">{k.value}</div>
                    <div>{k.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {resultado.erroresImport.length>0&&(
              <div className="alert alert-danger">
                <strong>Errores:</strong>
                <ul className="mb-0 mt-2">
                  {resultado.erroresImport.map((e,i)=>(
                    <li key={i} className="small">Fila {e.fila} — <code>{e.codigo}</code>: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-center mt-3">
              <button className="btn btn-info text-white" onClick={reiniciar}>
                <i className="bi bi-arrow-repeat me-1"></i>Nueva importación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}