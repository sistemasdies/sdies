import { useState } from 'react';
import { importarMembresias } from '../../api/membresias';
import toast from 'react-hot-toast';

// ── Columnas de la tabla Membresia ──────────────────────────────────────────
const CAMPOS = [
  { key: 'cedula',                   req: true,  ejemplo: '1234567890' },
  { key: 'estado_civil',             ejemplo: '1=Soltero … 5=Viudo' },
  { key: 'fecha_matrimonio',         ejemplo: 'AAAA-MM-DD' },
  { key: 'tipo_matrimonio',          ejemplo: 'C, J, R o A' },
  { key: 'lugar_matrimonio',         ejemplo: 'Ciudad' },
  { key: 'nombre_oficiado_por',      ejemplo: 'Quién celebró' },
  { key: 'nombre_papa',              ejemplo: 'Nombre del padre' },
  { key: 'nombre_mama',              ejemplo: 'Nombre de la madre' },
  { key: 'nombre_conyuge',           ejemplo: 'Nombre del cónyuge' },
  { key: 'personas_a_cargo',         ejemplo: 'Número entero' },
  { key: 'comentario_familiar',      ejemplo: 'Texto libre' },
  { key: 'folio_reg_civil',          ejemplo: 'Número de folio' },
  { key: 'oficina_reg_civil',        ejemplo: 'Oficina de registro' },
  { key: 'lugar_fallecimiento',      ejemplo: 'Ciudad' },
  { key: 'fecha_fallecido',          ejemplo: 'AAAA-MM-DD' },
  { key: 'escolaridad',              ejemplo: 'Primaria, Bachiller…' },
  { key: 'profesion',                ejemplo: 'Profesión' },
  { key: 'ocupacion',                ejemplo: 'Ocupación actual' },
  { key: 'lugar_de_trabajo',         ejemplo: 'Empresa o lugar' },
  { key: 'telefono_trabajo',         ejemplo: 'Teléfono' },
  { key: 'comentarios_academico_laboral', ejemplo: 'Texto libre' },
  { key: 'estado',                   ejemplo: '1=Activo … 7=Desconocido' },
  { key: 'comentarios_eclesiales',   ejemplo: 'Texto libre' },
  { key: 'congregacion',             ejemplo: 'Código de congregación' },
  { key: 'sw_bautizado',             ejemplo: 'true / false' },
  { key: 'serial_bautismo',          ejemplo: 'Número entero' },
  { key: 'fecha_bautismo',           ejemplo: 'AAAA-MM-DD' },
  { key: 'lugar_bautismo',           ejemplo: 'Ciudad' },
  { key: 'pastor_que_bautizo',       ejemplo: 'Nombre del pastor' },
  { key: 'sw_promesado',             ejemplo: 'true / false' },
  { key: 'serial_membresia',         ejemplo: 'Número entero' },
  { key: 'fecha_promesado',          ejemplo: 'AAAA-MM-DD' },
  { key: 'lugar_promesado',          ejemplo: 'Ciudad' },
  { key: 'congregacion_anterior',    ejemplo: 'Código o nombre' },
  { key: 'salio_para',               ejemplo: 'Destino' },
  { key: 'fecha_llegada',            ejemplo: 'AAAA-MM-DD' },
  { key: 'fecha_salida',             ejemplo: 'AAAA-MM-DD' },
  { key: 'foto',                     ejemplo: 'URL de la foto' },
  { key: 'foto_public_id',           ejemplo: 'ID en Cloudinary' },
];

const FECHAS = new Set([
  'fecha_matrimonio', 'fecha_fallecido', 'fecha_bautismo',
  'fecha_promesado', 'fecha_llegada', 'fecha_salida',
]);
const ENTEROS = new Set([
  'personas_a_cargo', 'serial_bautismo', 'serial_membresia',
]);

const MODOS = [
  { id: 'solo_nuevos', label: 'Solo adicionar nuevos', desc: 'Omite las cédulas que ya tienen membresía' },
  { id: 'reemplazar',  label: 'Reemplazar existentes', desc: 'Actualiza las membresías existentes (las nuevas se omiten)' },
  { id: 'ambos',       label: 'Ambos',                 desc: 'Actualiza las existentes y adiciona las nuevas' },
];

const ALIAS_HEADERS = {
  identificacion: 'cedula',
  documento: 'cedula',
  numero_documento: 'cedula',
  tipo_documento: 'tipo_documento',
};

const sinAcentos = (texto) =>
  String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizarHeader = (header) => {
  const limpio = sinAcentos(header)
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ALIAS_HEADERS[limpio] || limpio;
};

const detectarSeparador = (linea) => {
  const conteo = { ',': 0, ';': 0, '\t': 0 };
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') enComillas = !enComillas;
    else if (!enComillas && conteo[c] !== undefined) conteo[c]++;
  }
  return Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0];
};

const parsearLinea = (linea, separador) => {
  const valores = [];
  let actual = '';
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (enComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') { actual += '"'; i++; }
        else enComillas = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === separador) {
      valores.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  valores.push(actual);
  return valores.map(v => v.trim());
};

const fechaValida = (valor) => {
  const texto = String(valor || '').trim();
  if (!texto) return true;
  if (!/^\d{4}-\d{2}-\d{2}$|^\d{2}[/-]\d{2}[/-]\d{4}$/.test(texto)) return false;
  const [a, b, c] = texto.split(/[/-]/);
  const anio = a.length === 4 ? Number(a) : Number(c);
  const mes  = Number(b);
  const dia  = Number(a.length === 4 ? c : a);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getFullYear() === anio
      && fecha.getMonth() === mes - 1
      && fecha.getDate() === dia;
};

const escaparCSV = (valor) => {
  const texto = String(valor ?? '');
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

const EJEMPLO = {
  cedula: '1234567890',
  estado_civil: '2',
  fecha_matrimonio: '2015-06-20',
  tipo_matrimonio: 'R',
  lugar_matrimonio: 'Bogotá',
  nombre_oficiado_por: 'Pastor Juan Pérez',
  nombre_papa: 'Pedro Pérez',
  nombre_mama: 'Ana Gómez',
  nombre_conyuge: 'María López',
  personas_a_cargo: '2',
  comentario_familiar: 'Familia estable',
  folio_reg_civil: '123456',
  oficina_reg_civil: 'Registraduría Norte',
  lugar_fallecimiento: '',
  fecha_fallecido: '',
  escolaridad: 'Universitaria',
  profesion: 'Ingeniero',
  ocupacion: 'Docente',
  lugar_de_trabajo: 'Colegio Central',
  telefono_trabajo: '6011234567',
  comentarios_academico_laboral: '',
  estado: '1',
  comentarios_eclesiales: 'Miembro activo',
  congregacion: 'C001',
  sw_bautizado: 'true',
  serial_bautismo: '100',
  fecha_bautismo: '2010-04-10',
  lugar_bautismo: 'Bogotá',
  pastor_que_bautizo: 'Pastor Juan Pérez',
  sw_promesado: 'true',
  serial_membresia: '50',
  fecha_promesado: '2012-08-15',
  lugar_promesado: 'Bogotá',
  congregacion_anterior: 'C000',
  salio_para: 'C002',
  fecha_llegada: '2020-01-05',
  fecha_salida: '',
  foto: '',
  foto_public_id: '',
};

const PLANTILLA_CSV = '\ufeff'
  + CAMPOS.map(c => escaparCSV(c.key)).join(',') + '\r\n'
  + CAMPOS.map(c => escaparCSV(EJEMPLO[c.key] ?? '')).join(',') + '\r\n';

const ESTADO_LABEL = {
  1: 'Activo', 2: 'Ausente', 3: 'Vacaciones', 4: 'Trasladado',
  5: 'Enfermo', 6: 'Apartado', 7: 'Desconocido',
};

export default function ImportadorMembresia() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [paso,      setPaso]      = useState(1);
  const [modo,      setModo]      = useState('solo_nuevos');
  const [sepInfo,   setSepInfo]   = useState('');

  const parsearCSV = (texto) => {
    const limpio = texto.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lineas = limpio.split('\n').filter(l => l.trim());
    if (lineas.length < 2) return { datos: [], errs: [], sep: ',' };

    const sep = detectarSeparador(lineas[0]);
    const headers = parsearLinea(lineas[0], sep).map(normalizarHeader);
    const datos = [];
    const errs = [];

    lineas.slice(1).forEach((linea, idx) => {
      if (!linea.trim()) return;
      const valores = parsearLinea(linea, sep);
      const fila = {};
      headers.forEach((h, i) => { if (h) fila[h] = valores[i] || ''; });

      const errFila = [];
      if (!fila.cedula) errFila.push('Falta cédula');
      FECHAS.forEach(campo => {
        if (fila[campo] && !fechaValida(fila[campo])) {
          errFila.push(`${campo}: fecha inválida (use AAAA-MM-DD)`);
        }
      });
      ENTEROS.forEach(campo => {
        if (fila[campo] && !/^-?\d+$/.test(fila[campo])) {
          errFila.push(`${campo}: debe ser un número entero`);
        }
      });

      fila._fila = idx + 2;
      fila._errores = errFila;
      fila._valida = errFila.length === 0;
      datos.push(fila);
      if (errFila.length) errs.push({ fila: idx + 2, errores: errFila });
    });

    return { datos, errs, sep };
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { datos, errs, sep } = parsearCSV(ev.target.result);
      setFilas(datos);
      setErrores(errs);
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
      const registros = validas.map(f => {
        const reg = {};
        CAMPOS.forEach(c => { reg[c.key] = f[c.key] ?? ''; });
        reg._fila = f._fila;
        return reg;
      });
      const r = await importarMembresias({ modo, registros });
      setResultado(r.data);
      setPaso(3);

      const { creados, actualizados, omitidos, errores } = r.data;
      const fallidas = errores?.length || 0;
      if (creados)      toast.success(`${creados} membresía(s) creada(s)`);
      if (actualizados) toast.success(`${actualizados} membresía(s) actualizada(s)`);
      if (omitidos)     toast.info(`${omitidos} omitida(s)`);
      if (fallidas)     toast.error(`${fallidas} con error`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al importar membresías');
    } finally {
      setCargando(false);
    }
  };

  const reiniciar = () => {
    setFilas([]); setErrores([]); setResultado(null); setPaso(1);
  };

  const descargarPlantilla = () => {
    const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_membresias.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-person-vcard me-2 text-success"></i>Importar Membresías
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
              Importa miembros con <strong>todos los campos de la tabla Membresía</strong>.
              La cédula debe existir previamente en Terceros.
            </div>

            <h6 className="fw-semibold mb-2">
              <i className="bi bi-arrow-repeat me-1"></i>¿Cómo deseas importar?
            </h6>
            <div className="row g-2 mb-4">
              {MODOS.map(m => (
                <div key={m.id} className="col-md-4">
                  <label className={`card border h-100 ${modo === m.id ? 'border-success bg-success-subtle' : ''}`}
                    style={{ cursor: 'pointer' }}>
                    <div className="form-check p-3 mb-0">
                      <input className="form-check-input" type="radio" name="modo-membresia"
                        checked={modo === m.id} onChange={() => setModo(m.id)} />
                      <div className="ms-2">
                        <div className="fw-semibold small">{m.label}</div>
                        <div className="small text-muted">{m.desc}</div>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <h6 className="fw-semibold mb-2">Columnas del archivo:</h6>
            <div className="table-responsive mb-4" style={{ maxHeight: 300 }}>
              <table className="table table-sm table-bordered mb-0">
                <thead className="table-light sticky-top">
                  <tr><th>Columna</th><th>Requerida</th><th>Ejemplo / Valores</th></tr>
                </thead>
                <tbody>
                  {CAMPOS.map(c => (
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

            <div className="border rounded p-5 text-center" style={{ borderStyle: 'dashed', cursor: 'pointer' }}
              onClick={() => document.getElementById('file-membresias').click()}>
              <i className="bi bi-cloud-upload display-4 text-muted d-block mb-2"></i>
              <p className="mb-1 fw-semibold">Haz clic para seleccionar el CSV</p>
              <p className="text-muted small mb-0">Mismas columnas que la exportación de Membresías</p>
              <input type="file" id="file-membresias" accept=".csv,.txt"
                className="d-none" onChange={onFileChange} />
            </div>
          </div>
        )}

        {paso === 2 && (
          <div>
            <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
              <span className="badge bg-success fs-6">{filas.filter(f => f._valida).length} válidas</span>
              <span className="badge bg-danger fs-6">{filas.filter(f => !f._valida).length} con errores</span>
              <span className="badge bg-secondary fs-6">{filas.length} total</span>
              <span className="badge bg-info text-dark fs-6">Separador: {sepInfo}</span>
            </div>

            {errores.length > 0 && (
              <div className="alert alert-warning mb-3">
                <strong>Filas con errores (se omitirán):</strong>
                <ul className="mb-0 mt-1">
                  {errores.slice(0, 10).map(e => (
                    <li key={e.fila} className="small">Fila {e.fila}: {e.errores.join(', ')}</li>
                  ))}
                  {errores.length > 10 && (
                    <li className="small text-muted">...y {errores.length - 10} más</li>
                  )}
                </ul>
              </div>
            )}

            <div className="table-responsive" style={{ maxHeight: 380 }}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-dark sticky-top">
                  <tr>
                    <th>#</th><th>Est</th><th>Cédula</th><th>Estado</th>
                    <th>Congregación</th><th>Est. civil</th><th>Bautizado</th><th>Promesado</th>
                  </tr>
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
                      <td className="small">
                        {ESTADO_LABEL[f.estado] || f.estado || '—'}
                      </td>
                      <td className="small">{f.congregacion || '—'}</td>
                      <td className="small">{f.estado_civil || '—'}</td>
                      <td className="small">{f.sw_bautizado || 'false'}</td>
                      <td className="small">{f.sw_promesado || 'false'}</td>
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
                disabled={cargando || !filas.filter(f => f._valida).length}>
                {cargando
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Importando...</>
                  : <><i className="bi bi-upload me-1"></i>Importar {filas.filter(f => f._valida).length} membresías</>}
              </button>
            </div>
          </div>
        )}

        {paso === 3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                { label: 'Creadas',      value: resultado.creados,      color: 'success' },
                { label: 'Actualizadas', value: resultado.actualizados, color: 'primary' },
                { label: 'Omitidas',     value: resultado.omitidos,     color: 'secondary' },
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
                  {resultado.errores.map((e, i) => (
                    <li key={i} className="small">
                      Fila {e.fila} — <code>{e.cedula || 'sin cédula'}</code>: {e.error}
                    </li>
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
