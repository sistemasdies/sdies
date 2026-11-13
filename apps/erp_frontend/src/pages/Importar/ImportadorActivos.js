import { useState } from 'react';
import { importarActivos } from '../../api/activos';
import toast from 'react-hot-toast';

const PLANTILLA_CSV = `id_activo_f,nombre_activo_f,cantidad,categoria,marca,modelo,numero_serie,congregacion,ubicacion,responsable,estado_actual,fecha_adquisicion,valor_compra,comentarios
A0001,Laptop HP,1,COM,HP,EliteBook,X123,,BOD1,12345678,1,2024-01-15,2500000,Equipo principal`;

const MODOS = [
  { id: 'solo_nuevos', label: 'Solo adicionar nuevos', desc: 'Omite los activos cuyo código ya existe' },
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

export default function ImportadorActivos() {
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
      if (!fila.id_activo_f) errFila.push('Falta código');
      if (!fila.nombre_activo_f) errFila.push('Falta nombre');
      if (!fila.categoria) errFila.push('Falta categoría');
      if (!fila.ubicacion) errFila.push('Falta ubicación');
      if (!fila.estado_actual) errFila.push('Falta estado');
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
    try {
      const registros = validas.map(f => ({
        id_activo_f: f.id_activo_f,
        nombre_activo_f: f.nombre_activo_f,
        cantidad: f.cantidad === '' ? 1 : parseInt(f.cantidad, 10),
        categoria: f.categoria,
        marca: f.marca,
        modelo: f.modelo,
        numero_serie: f.numero_serie,
        congregacion: f.congregacion || null,
        ubicacion: f.ubicacion,
        responsable: f.responsable || null,
        estado_actual: f.estado_actual,
        fecha_adquisicion: f.fecha_adquisicion || null,
        valor_compra: f.valor_compra || null,
        comentarios: f.comentarios,
      }));
      const r = await importarActivos({ modo, registros });
      const { creados, actualizados, omitidos, errores } = r.data;
      setResultado({ creados, actualizados, omitidos, errores });
      if (creados) toast.success(`${creados} activo(s) creado(s)`);
      if (actualizados) toast.success(`${actualizados} activo(s) actualizado(s)`);
      if (omitidos) toast.info(`${omitidos} omitido(s)`);
      if (errores?.length) toast.error(`${errores.length} con error`);
    } catch (err) {
      toast.error(extraerError(err));
    }
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
