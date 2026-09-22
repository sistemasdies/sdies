import { useState } from 'react';
import { createCentroCosto } from '../../api/centrosCosto';
import toast from 'react-hot-toast';

const PLANTILLA_CSV = `codigo,descripcion,responsable
CC001,Administración General,
CC002,Ventas Nacionales,1234567890
CC003,Producción Planta 1,`;

export default function ImportadorCentrosCosto() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [paso,      setPaso]      = useState(1);

  const parsearCSV = (texto) => {
    const lineas  = texto.trim().split('\n');
    const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());
    const datos   = [];
    const errs    = [];

    lineas.slice(1).forEach((linea, idx) => {
      if (!linea.trim()) return;
      const valores = linea.split(',').map(v => v.trim().replace(/"/g,''));
      const fila    = {};
      headers.forEach((h, i) => { fila[h] = valores[i] || ''; });

      const errFila = [];
      if (!fila.codigo)      errFila.push('Falta código');
      if (!fila.descripcion) errFila.push('Falta descripción');
      if (fila.codigo && fila.codigo.length > 7) errFila.push('Código max 7 caracteres');

      fila._fila    = idx + 2;
      fila._errores = errFila;
      fila._valida  = errFila.length === 0;
      datos.push(fila);
      if (errFila.length) errs.push({ fila: idx+2, errores: errFila });
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
  };

  const importar = async () => {
    const validas = filas.filter(f => f._valida);
    if (!validas.length) { toast.error('No hay filas válidas'); return; }
    setCargando(true);
    let ok = 0, fail = 0, erroresImport = [];
    for (const f of validas) {
      try {
        await createCentroCosto({
          codigo:      f.codigo.toUpperCase(),
          descripcion: f.descripcion,
          responsable: f.responsable || null,
        });
        ok++;
      } catch (err) {
        fail++;
        erroresImport.push({
          fila: f._fila, codigo: f.codigo,
          error: err.response?.data?.codigo?.[0] || err.response?.data?.detail || 'Error',
        });
      }
    }
    setCargando(false);
    setResultado({ ok, fail, erroresImport });
    setPaso(3);
    if (ok)   toast.success(`${ok} centro(s) importado(s)`);
    if (fail) toast.error(`${fail} con error`);
  };

  const reiniciar = () => { setFilas([]); setErrores([]); setResultado(null); setPaso(1); };

  const descargarPlantilla = () => {
    const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'plantilla_centros_costo.csv'; a.click();
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-bullseye me-2 text-warning"></i>Importar Centros de Costo
        </span>
        <button className="btn btn-outline-secondary btn-sm" onClick={descargarPlantilla}>
          <i className="bi bi-download me-1"></i>Descargar plantilla CSV
        </button>
      </div>
      <div className="card-body">

        {paso === 1 && (
          <div>
            <div className="alert alert-warning">
              <i className="bi bi-info-circle me-2"></i>
              El campo <strong>responsable</strong> es la cédula del tercero responsable (opcional).
              Debe existir previamente en el sistema.
            </div>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-bordered">
                <thead className="table-light">
                  <tr><th>Columna</th><th>Requerida</th><th>Descripción</th></tr>
                </thead>
                <tbody>
                  <tr><td><code>codigo</code></td><td><span className="badge bg-danger">Sí</span></td><td>Código único, máx 7 caracteres</td></tr>
                  <tr><td><code>descripcion</code></td><td><span className="badge bg-danger">Sí</span></td><td>Nombre del centro de costo</td></tr>
                  <tr><td><code>responsable</code></td><td><span className="badge bg-secondary">No</span></td><td>Cédula del responsable</td></tr>
                </tbody>
              </table>
            </div>
            <div className="border rounded p-5 text-center" style={{borderStyle:'dashed', cursor:'pointer'}}
              onClick={() => document.getElementById('file-cc').click()}>
              <i className="bi bi-cloud-upload display-4 text-muted d-block mb-2"></i>
              <p className="mb-1 fw-semibold">Haz clic para seleccionar el CSV</p>
              <input type="file" id="file-cc" accept=".csv,.txt" className="d-none" onChange={onFileChange} />
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
                  {errores.map(e => <li key={e.fila} className="small">Fila {e.fila}: {e.errores.join(', ')}</li>)}
                </ul>
              </div>
            )}
            <div className="table-responsive" style={{maxHeight:360}}>
              <table className="table table-sm table-hover">
                <thead className="table-dark sticky-top">
                  <tr><th>#</th><th>Estado</th><th>Código</th><th>Descripción</th><th>Responsable</th></tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f._fila} className={!f._valida ? 'table-danger' : ''}>
                      <td className="small text-muted">{f._fila}</td>
                      <td>{f._valida
                        ? <i className="bi bi-check-circle-fill text-success"></i>
                        : <i className="bi bi-x-circle-fill text-danger" title={f._errores.join(', ')}></i>}
                      </td>
                      <td><code>{f.codigo}</code></td>
                      <td className="small">{f.descripcion}</td>
                      <td className="small">{f.responsable || <span className="text-muted fst-italic">Sin asignar</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex gap-2 mt-3 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={reiniciar}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-warning text-dark" onClick={importar}
                disabled={cargando || !filas.filter(f=>f._valida).length}>
                {cargando
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Importando...</>
                  : <><i className="bi bi-upload me-1"></i>Importar {filas.filter(f=>f._valida).length} centros</>}
              </button>
            </div>
          </div>
        )}

        {paso === 3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                { label: 'Importados', value: resultado.ok,   color: 'success'   },
                { label: 'Con error',  value: resultado.fail, color: 'danger'    },
                { label: 'Total',      value: resultado.ok+resultado.fail, color: 'secondary' },
              ].map(k => (
                <div key={k.label} className="col-md-4">
                  <div className={`card border-0 bg-${k.color} text-white text-center p-3`}>
                    <div className="display-6 fw-bold">{k.value}</div>
                    <div className="small">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {resultado.erroresImport.length > 0 && (
              <div className="alert alert-danger">
                <strong>Errores:</strong>
                <ul className="mb-0 mt-2">
                  {resultado.erroresImport.map((e,i) => (
                    <li key={i} className="small">Fila {e.fila} — <code>{e.codigo}</code>: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-center mt-3">
              <button className="btn btn-warning text-dark" onClick={reiniciar}>
                <i className="bi bi-arrow-repeat me-1"></i>Nueva importación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
