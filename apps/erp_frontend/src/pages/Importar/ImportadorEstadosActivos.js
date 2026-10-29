import { useState } from 'react';
import { createEstadoActivo, updateEstadoActivo, getEstadosActivo } from '../../api/activos';
import toast from 'react-hot-toast';

const PLANTILLA_CSV = `estado_activo_f,descripcion_estado_activo_f
1,Activo
2,Inactivo`;

const MODOS = [
  { id: 'solo_nuevos', label: 'Solo adicionar nuevos', desc: 'Omite los estados cuyo código ya existe' },
  { id: 'reemplazar',  label: 'Reemplazar existentes', desc: 'Actualiza los que ya existen' },
  { id: 'ambos',       label: 'Ambos',                 desc: 'Actualiza las existentes y adiciona las nuevas' },
];

const extraerError = (err) => {
  const data = err?.response?.data;
  if (!data) return 'Error de conexión';
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  const primera = Object.values(data)[0];
  if (Array.isArray(primera)) return primera[0];
  if (typeof primera === 'string') return primera;
  return JSON.stringify(data);
};

export default function ImportadorEstadosActivos() {
  const [filas, setFilas] = useState([]);
  const [errores, setErrores] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState(1);
  const [modo, setModo] = useState('solo_nuevos');

  const parsearCSV = (texto) => {
    const lineas = texto.trim().split('\n');
    const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());
    const datos = [];
    const errs = [];
    lineas.slice(1).forEach((linea, idx) => {
      if (!linea.trim()) return;
      const valores = linea.split(',').map(v => v.trim().replace(/"/g, ''));
      const fila = {};
      headers.forEach((h, i) => { fila[h] = valores[i] || ''; });
      const errFila = [];
      if (!fila.estado_activo_f) errFila.push('Falta estado');
      if (!fila.descripcion_estado_activo_f) errFila.push('Falta descripción');
      fila._fila = idx + 2;
      fila._errores = errFila;
      fila._valida = errFila.length === 0;
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
    const existentes = new Map();
    try {
      const r = await getEstadosActivo({ page_size: 10000 });
      (r.data.results || r.data || []).forEach(e => existentes.set(e.estado_activo_f, e));
    } catch {}
    let creados = 0, actualizados = 0, omitidos = 0;
    const erroresImport = [];
    for (const fila of validas) {
      try {
        const ex = existentes.get(fila.estado_activo_f);
        if (ex && modo === 'solo_nuevos') { omitidos++; continue; }
        if (!ex && modo === 'reemplazar') { omitidos++; continue; }
        const payload = { estado_activo_f: fila.estado_activo_f, descripcion_estado_activo_f: fila.descripcion_estado_activo_f };
        if (ex) { await updateEstadoActivo(ex.estado_activo_f, payload); actualizados++; }
        else { await createEstadoActivo(payload); creados++; }
      } catch (err) {
        erroresImport.push({ fila: fila._fila, error: extraerError(err) });
      }
    }
    setResultado({ creados, actualizados, omitidos, errores: erroresImport });
    setCargando(false);
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="mb-3">
          <label className="form-label fw-semibold">Archivo CSV</label>
          <input type="file" accept=".csv" className="form-control" onChange={onFileChange} />
          <div className="form-text">Plantilla: <code>{PLANTILLA_CSV.replace(/\n/g, ' | ')}</code></div>
        </div>
        {paso === 2 && (
          <>
            <div className="mb-3">
              <label className="form-label fw-semibold">Modo de importación</label>
              <div className="d-flex gap-2 flex-wrap">
                {MODOS.map(m => (
                  <button key={m.id} type="button" className={`btn btn-sm ${modo === m.id ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => setModo(m.id)}>{m.label}</button>
                ))}
              </div>
            </div>
            <button className="btn btn-success" onClick={importar} disabled={cargando}>
              {cargando ? 'Importando...' : `Importar ${filas.filter(f => f._valida).length} filas válidas`}
            </button>
          </>
        )}
        {resultado && (
          <div className="alert alert-info mt-3">
            Creados: {resultado.creados} | Actualizados: {resultado.actualizados} | Omitidos: {resultado.omitidos} | Errores: {resultado.errores.length}
          </div>
        )}
      </div>
    </div>
  );
}
