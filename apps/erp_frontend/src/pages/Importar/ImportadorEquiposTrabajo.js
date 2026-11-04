import { useState } from 'react';
import { importarEquiposTrabajo } from '../../api/equiposTrabajo';
import toast from 'react-hot-toast';

const PLANTILLA_CSV = `id,area_trabajo,cargo,congregacion,responsable,vigencia_desde,vigencia_hasta,comentarios
,ADM,01,C001,1234567890,2024-01-01,2024-12-31,Comentarios del equipo
,MUS,02,,9876543210,2024-06-01,,`;

const MODOS = [
  { id: 'solo_nuevos', label: 'Solo adicionar nuevos', desc: 'Omite los registros cuyo id ya existe; si no tiene id los crea' },
  { id: 'reemplazar',  label: 'Reemplazar existentes', desc: 'Actualiza los registros con id existente (los nuevos se omiten)' },
  { id: 'ambos',       label: 'Ambos',                 desc: 'Actualiza los existentes y adiciona los nuevos' },
];

export default function ImportadorEquiposTrabajo() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [paso,      setPaso]      = useState(1);
  const [modo,      setModo]      = useState('solo_nuevos');

  const parsearCSV = (texto) => {
    const lineas  = texto.trim().split('\n');
    const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());
    const datos   = [];
    const errs    = [];

    lineas.slice(1).forEach((linea, idx) => {
      if (!linea.trim()) return;
      const valores = linea.split(',').map(v => v.trim().replace(/"/g, ''));
      const fila    = {};
      headers.forEach((h, i) => { fila[h] = valores[i] || ''; });

      const errFila = [];
      if (!fila.area_trabajo) errFila.push('Falta área de trabajo');
      if (!fila.cargo)        errFila.push('Falta cargo');
      if (!fila.responsable)  errFila.push('Falta responsable');
      if (fila.vigencia_desde && !/^\d{4}-\d{2}-\d{2}$/.test(fila.vigencia_desde)) errFila.push('Vigencia desde inválida');
      if (fila.vigencia_hasta && !/^\d{4}-\d{2}-\d{2}$/.test(fila.vigencia_hasta)) errFila.push('Vigencia hasta inválida');

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
    try {
      const registros = validas.map(f => ({
        id: f.id || null,
        area_trabajo: f.area_trabajo,
        cargo: f.cargo,
        congregacion: f.congregacion || null,
        responsable: f.responsable,
        vigencia_desde: f.vigencia_desde || null,
        vigencia_hasta: f.vigencia_hasta || null,
        comentarios: f.comentarios || '',
        _fila: f._fila,
      }));
      const r = await importarEquiposTrabajo({ modo, registros });
      setResultado(r.data);
      setPaso(3);
      const { creados, actualizados, omitidos, errores } = r.data;
      const fallidas = errores?.length || 0;
      if (creados)      toast.success(`${creados} equipo(s) creado(s)`);
      if (actualizados) toast.success(`${actualizados} equipo(s) actualizado(s)`);
      if (omitidos)     toast.info(`${omitidos} omitido(s)`);
      if (fallidas)     toast.error(`${fallidas} con error`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al importar equipos de trabajo');
    } finally { setCargando(false); }
  };

  const reiniciar = () => { setFilas([]); setErrores([]); setResultado(null); setPaso(1); };

  const descargarPlantilla = () => {
    const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'plantilla_equipos_trabajo.csv'; a.click();
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-people-fill me-2 text-success"></i>Importar Equipos de Trabajo
        </span>
        <button className="btn btn-outline-secondary btn-sm" onClick={descargarPlantilla}>
          <i className="bi bi-download me-1"></i>Descargar plantilla CSV
        </button>
      </div>
      <div className="card-body">
        {paso === 1 && (
          <div>
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              Importa equipos de trabajo. <strong>id</strong> se usa para actualizar;
              déjelo vacío para crear. Área, cargo y responsable son obligatorios.
            </div>

            <h6 className="fw-semibold mb-2"><i className="bi bi-arrow-repeat me-1"></i>¿Cómo deseas importar?</h6>
            <div className="row g-2 mb-4">
              {MODOS.map(m => (
                <div key={m.id} className="col-md-4">
                  <label className={`card border h-100 ${modo===m.id ? 'border-success bg-success-subtle' : ''}`}
                    style={{ cursor:'pointer' }}>
                    <div className="form-check p-3 mb-0">
                      <input className="form-check-input" type="radio" name="modo-equipos"
                        checked={modo===m.id} onChange={() => setModo(m.id)} />
                      <div className="ms-2">
                        <div className="fw-semibold small">{m.label}</div>
                        <div className="small text-muted">{m.desc}</div>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="table-responsive mb-4">
              <table className="table table-sm table-bordered">
                <thead className="table-light"><tr><th>Columna</th><th>Requerida</th><th>Descripción</th></tr></thead>
                <tbody>
                  <tr><td><code>id</code></td><td><span className="badge bg-secondary">No</span></td><td>Interno del sistema; solo para actualizar</td></tr>
                  <tr><td><code>area_trabajo</code></td><td><span className="badge bg-danger">Sí</span></td><td>Código del área</td></tr>
                  <tr><td><code>cargo</code></td><td><span className="badge bg-danger">Sí</span></td><td>Código del cargo</td></tr>
                  <tr><td><code>congregacion</code></td><td><span className="badge bg-secondary">No</span></td><td>Código de congregación</td></tr>
                  <tr><td><code>responsable</code></td><td><span className="badge bg-danger">Sí</span></td><td>Cédula del responsable (membresía)</td></tr>
                  <tr><td><code>vigencia_desde</code></td><td><span className="badge bg-secondary">No</span></td><td>AAAA-MM-DD</td></tr>
                  <tr><td><code>vigencia_hasta</code></td><td><span className="badge bg-secondary">No</span></td><td>AAAA-MM-DD</td></tr>
                  <tr><td><code>comentarios</code></td><td><span className="badge bg-secondary">No</span></td><td>Texto libre</td></tr>
                </tbody>
              </table>
            </div>
            <div className="border rounded p-5 text-center" style={{borderStyle:'dashed', cursor:'pointer'}}
              onClick={() => document.getElementById('file-equipos').click()}>
              <i className="bi bi-cloud-upload display-4 text-muted d-block mb-2"></i>
              <p className="mb-1 fw-semibold">Haz clic para seleccionar el CSV</p>
              <input type="file" id="file-equipos" accept=".csv,.txt" className="d-none" onChange={onFileChange} />
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
                  <tr><th>#</th><th>Est</th><th>Área</th><th>Cargo</th><th>Congregación</th><th>Responsable</th><th>Vig. desde</th><th>Vig. hasta</th></tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f._fila} className={!f._valida ? 'table-danger' : ''}>
                      <td className="small text-muted">{f._fila}</td>
                      <td>{f._valida
                        ? <i className="bi bi-check-circle-fill text-success"></i>
                        : <i className="bi bi-x-circle-fill text-danger" title={f._errores.join(', ')}></i>}
                      </td>
                      <td className="small"><code>{f.area_trabajo}</code></td>
                      <td className="small"><code>{f.cargo}</code></td>
                      <td className="small">{f.congregacion || '—'}</td>
                      <td className="small">{f.responsable}</td>
                      <td className="small">{f.vigencia_desde || '—'}</td>
                      <td className="small">{f.vigencia_hasta || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex gap-2 mt-3 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={reiniciar} disabled={cargando}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-success" onClick={importar}
                disabled={cargando || !filas.filter(f=>f._valida).length}>
                {cargando
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Importando...</>
                  : <><i className="bi bi-upload me-1"></i>Importar {filas.filter(f=>f._valida).length} equipos</>}
              </button>
            </div>
          </div>
        )}

        {paso === 3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                { label: 'Creados',      value: resultado.creados,      color: 'success' },
                { label: 'Actualizados', value: resultado.actualizados, color: 'primary' },
                { label: 'Omitidos',     value: resultado.omitidos,     color: 'secondary' },
                { label: 'Con error',    value: resultado.errores?.length || 0, color: 'danger' },
              ].map(k => (
                <div key={k.label} className="col-md-3">
                  <div className={`card border-0 bg-${k.color} text-white text-center p-3`}>
                    <div className="display-6 fw-bold">{k.value}</div>
                    <div className="small">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {resultado.errores?.length > 0 && (
              <div className="alert alert-danger">
                <strong>Errores:</strong>
                <ul className="mb-0 mt-2">
                  {resultado.errores.map((e,i) => (
                    <li key={i} className="small">Fila {e.fila}: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-center mt-3">
              <button className="btn btn-success" onClick={reiniciar}>
                <i className="bi bi-arrow-repeat me-1"></i>Nueva importación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
