import { useState } from 'react';
import { importarTerceros } from '../../api/terceros';
import toast from 'react-hot-toast';

// Normaliza los encabezados del CSV a los campos reales del modelo,
// acepta tanto formato exportado (TipoDocumento, RazonSocial...) como snake_case.
const MAPEO_HEADERS = {
  cedula: 'cedula',
  tipodocumento: 'tipo_documento',
  lugarexpcedula: 'lugar_exp_cedula',
  tipopersona: 'tipo_persona',
  nombre1: 'nombre1',
  nombre2: 'nombre2',
  apellido1: 'apellido1',
  apellido2: 'apellido2',
  razonsocial: 'razon_social',
  direccion: 'direccion',
  telefono1: 'telefono1',
  telefono2: 'telefono2',
  celular: 'celular',
  email: 'email',
  fax: 'fax',
  barrio: 'barrio',
  lugarnacimiento: 'lugar_nacimiento',
  sexo: 'sexo',
  comentarios: 'comentarios',
  distrito: 'distrito',
  departamento: 'departamento',
  municipio: 'municipio',
  fechanacimiento: 'fecha_nacimiento',
};

const MODOS = [
  { id: 'solo_nuevos', label: 'Solo adicionar nuevos', desc: 'Omite registros cuya cédula ya existe' },
  { id: 'reemplazar',  label: 'Reemplazar existentes', desc: 'Actualiza los registros que ya existen (los nuevos se omiten)' },
  { id: 'ambos',       label: 'Ambos',                 desc: 'Actualiza los existentes y adiciona los nuevos' },
];

const PLANTILLA_CSV = `Cedula,TipoDocumento,LugarExpCedula,TipoPersona,Nombre1,Nombre2,Apellido1,Apellido2,RazonSocial,Direccion,Telefono1,Telefono2,Celular,eMail,Fax,Barrio,LugarNacimiento,Sexo,Comentarios,Distrito,Departamento,Municipio,FechaNacimiento
1234567890,CC,Bogotá,N,Juan,Carlos,Pérez,García,,Calle 10 #5-20,3001234567,6012345678,3101234567,juan@email.com,,La Candelaria,Bogotá,M,Cliente frecuente,01,11,001,1990-05-15
900123456,NI,Medellín,J,,,,,Empresas SA,Av Principal 1,6041234567,,3121234567,info@empresa.com,6047654321,Centro,Medellín,F,Proveedor oficial,02,05,001,1999-01-01`;

const COLUMNAS = [
  { key: 'cedula',            label: 'cedula',           req: true  },
  { key: 'tipo_documento',    label: 'tipo_documento',   req: false, ejemplo: 'Indicativo, sin validar' },
  { key: 'lugar_exp_cedula',  label: 'lugar_exp_cedula', req: false, ejemplo: 'Ciudad de expedición' },
  { key: 'tipo_persona',      label: 'tipo_persona',     req: false, ejemplo: 'N o J' },
  { key: 'nombre1',           label: 'nombre1',          req: false },
  { key: 'nombre2',           label: 'nombre2',          req: false },
  { key: 'apellido1',         label: 'apellido1',        req: false },
  { key: 'apellido2',         label: 'apellido2',        req: false },
  { key: 'razon_social',      label: 'razon_social',     req: false, ejemplo: 'Para jurídicas' },
  { key: 'direccion',         label: 'direccion',        req: false },
  { key: 'telefono1',         label: 'telefono1',        req: false },
  { key: 'telefono2',         label: 'telefono2',        req: false },
  { key: 'celular',           label: 'celular',          req: false },
  { key: 'email',             label: 'eMail',            req: false },
  { key: 'fax',               label: 'fax',              req: false },
  { key: 'barrio',            label: 'barrio',           req: false },
  { key: 'lugar_nacimiento',  label: 'lugar_nacimiento', req: false, ejemplo: 'Ciudad de nacimiento' },
  { key: 'sexo',              label: 'sexo',             req: false, ejemplo: 'M o F' },
  { key: 'comentarios',       label: 'comentarios',      req: false },
  { key: 'distrito',          label: 'distrito',         req: false, ejemplo: 'Código 2 dígitos' },
  { key: 'departamento',      label: 'departamento',     req: false, ejemplo: 'Código 2 dígitos' },
  { key: 'municipio',         label: 'municipio',        req: false, ejemplo: 'Código 3 dígitos' },
  { key: 'fecha_nacimiento',  label: 'fecha_nacimiento', req: false, ejemplo: 'YYYY-MM-DD' },
];

export default function ImportadorTerceros() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [paso,      setPaso]      = useState(1);
  const [modo,      setModo]      = useState('solo_nuevos');

  const parsearCSV = (texto) => {
    const lineas  = texto.trim().split('\n');
    const headers = lineas[0].split(',').map(h => {
      const norm = h.trim().toLowerCase();
      return MAPEO_HEADERS[norm] || norm;
    });
    const datos   = [];
    const errs    = [];

    lineas.slice(1).forEach((linea, idx) => {
      if (!linea.trim()) return;
      const valores = linea.split(',').map(v => v.trim().replace(/"/g, ''));
      const fila    = {};
      headers.forEach((h, i) => { fila[h] = valores[i] || ''; });

      const errFila = [];
      if (!fila.cedula) errFila.push('Falta cédula');
      if (fila.tipo_persona === 'J' && !fila.razon_social) errFila.push('Jurídica requiere razón social');

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
  };

  const importar = async () => {
    const validas = filas.filter(f => f._valida);
    if (!validas.length) { toast.error('No hay filas válidas'); return; }
    setCargando(true);
    try {
      const registros = validas.map(f => ({
        cedula:            f.cedula,
        tipo_documento:    f.tipo_documento    || '',
        lugar_exp_cedula:  f.lugar_exp_cedula  || '',
        tipo_persona:      f.tipo_persona      || 'N',
        nombre1:           f.nombre1           || '',
        nombre2:           f.nombre2           || '',
        apellido1:         f.apellido1         || '',
        apellido2:         f.apellido2         || '',
        razon_social:      f.razon_social      || '',
        fecha_nacimiento:  f.fecha_nacimiento  || null,
        lugar_nacimiento:  f.lugar_nacimiento  || '',
        sexo:              f.sexo              || '',
        direccion:         f.direccion         || '',
        barrio:            f.barrio            || '',
        telefono1:         f.telefono1         || '',
        telefono2:         f.telefono2         || '',
        celular:           f.celular           || '',
        fax:               f.fax               || '',
        email:             f.email             || '',
        departamento:      f.departamento      || '',
        municipio:         f.municipio         || '',
        distrito:          f.distrito          || '',
        comentarios:       f.comentarios       || '',
      }));
      const r = await importarTerceros({ modo, registros });
      setResultado(r.data);
      setPaso(3);
      const { creados, actualizados, omitidos, errores } = r.data;
      const fail = errores?.length || 0;
      if (creados)     toast.success(`${creados} creado(s)`);
      if (actualizados) toast.success(`${actualizados} actualizado(s)`);
      if (omitidos)    toast.info(`${omitidos} omitido(s)`);
      if (fail)        toast.error(`${fail} con error`);
    } catch (err) {
      setCargando(false);
      toast.error(err.response?.data?.detail || 'Error al importar');
    }
  };

  const reiniciar = () => { setFilas([]); setErrores([]); setResultado(null); setPaso(1); };

  const descargarPlantilla = () => {
    const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'plantilla_terceros.csv'; a.click();
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-people me-2 text-primary"></i>Importar Terceros
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
              Importa clientes, proveedores y empleados desde un archivo CSV.
            </div>

            <h6 className="fw-semibold mb-2">
              <i className="bi bi-arrow-repeat me-1"></i>¿Cómo deseas importar?
            </h6>
            <div className="row g-2 mb-4">
              {MODOS.map(m => (
                <div key={m.id} className="col-md-4">
                  <label className={`card border h-100 ${modo===m.id ? 'border-primary bg-primary-subtle' : ''}`}
                    style={{ cursor:'pointer' }}>
                    <div className="form-check p-3 mb-0">
                      <input className="form-check-input" type="radio" name="modo-import"
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

            <h6 className="fw-semibold mb-2">Columnas:</h6>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-bordered">
                <thead className="table-light">
                  <tr><th>Columna</th><th>Requerida</th><th>Ejemplo / Valores</th></tr>
                </thead>
                <tbody>
                  {COLUMNAS.map(c => (
                    <tr key={c.key}>
                      <td><code>{c.key}</code></td>
                      <td className="text-center">
                        {c.req ? <span className="badge bg-danger">Sí</span>
                               : <span className="badge bg-secondary">No</span>}
                      </td>
                      <td className="small text-muted">{c.ejemplo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border rounded p-5 text-center" style={{ borderStyle:'dashed', cursor:'pointer' }}
              onClick={() => document.getElementById('file-terceros').click()}>
              <i className="bi bi-cloud-upload display-4 text-muted d-block mb-2"></i>
              <p className="mb-1 fw-semibold">Haz clic para seleccionar el CSV</p>
              <input type="file" id="file-terceros" accept=".csv,.txt"
                className="d-none" onChange={onFileChange} />
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
            <div className="table-responsive" style={{maxHeight:380}}>
              <table className="table table-sm table-hover">
                <thead className="table-dark sticky-top">
                  <tr><th>#</th><th>Est</th><th>Cédula</th><th>Doc</th>
                      <th>Nombre / Razón social</th><th>Teléfono</th><th>Celular</th><th>Email</th></tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f._fila} className={!f._valida ? 'table-danger' : ''}>
                      <td className="small text-muted">{f._fila}</td>
                      <td>{f._valida
                        ? <i className="bi bi-check-circle-fill text-success"></i>
                        : <i className="bi bi-x-circle-fill text-danger" title={f._errores.join(', ')}></i>}
                      </td>
                      <td><code className="small">{f.cedula}</code></td>
                      <td><span className="badge bg-secondary">{f.tipo_documento||''}</span></td>
                      <td className="small">
                        {f.tipo_persona==='J' ? f.razon_social
                          : `${[f.nombre1,f.nombre2,f.apellido1,f.apellido2].filter(Boolean).join(' ')}`.trim() || '—'}
                      </td>
                      <td className="small">{f.telefono1 || '—'}</td>
                      <td className="small">{f.celular || '—'}</td>
                      <td className="small">{f.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex gap-2 mt-3 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={reiniciar}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-primary" onClick={importar}
                disabled={cargando || !filas.filter(f=>f._valida).length}>
                {cargando
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Importando...</>
                  : <><i className="bi bi-upload me-1"></i>Importar {filas.filter(f=>f._valida).length} terceros</>}
              </button>
            </div>
          </div>
        )}

        {paso === 3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                { label: 'Creados',      value: resultado.creados,     color: 'success' },
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
                    <li key={i} className="small">Fila {e.fila} — <code>{e.cedula}</code>: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-center mt-3">
              <button className="btn btn-primary" onClick={reiniciar}>
                <i className="bi bi-arrow-repeat me-1"></i>Nueva importación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
