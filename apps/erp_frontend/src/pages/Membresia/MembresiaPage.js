import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import SelectorTercero from '../../components/common/SelectorTercero';
import SelectorCongregacion from '../../components/common/SelectorCongregacion';
import { usePerm } from '../../hooks/usePerm';
import {
  getMembresias, createMembresia, updateMembresia, deleteMembresia,
  buscarTerceroPorCedula, getCedulasConMembresia,
  subirFotoMembresia, eliminarFotoMembresia,
} from '../../api/membresias';

const PAGE_SIZE = 50;

// ── Catálogos ───────────────────────────────────────────────────────────────
const ESTADOS = [
  ['1', 'Activo'], ['2', 'Ausente'], ['3', 'Vacaciones'],
  ['4', 'Trasladado'], ['5', 'Enfermo'], ['6', 'Apartado'], ['7', 'Desconocido'],
];
const ESTADOS_CIVIL = [
  ['1', 'Soltero'], ['2', 'Casado'], ['3', 'Divorciado'],
  ['4', 'Separado'], ['5', 'Viudo'],
];
const TIPOS_MATRIMONIO = [
  ['C', 'Civil'], ['J', 'Juzgado'], ['R', 'Religioso'], ['A', 'Alcaldía'],
];
const SEXOS = [['M', 'Masculino'], ['F', 'Femenino']];

const ESTADO_COLOR = { 1:'success', 2:'secondary', 3:'info', 4:'primary', 5:'danger', 6:'warning', 7:'dark' };
const ESTADO_LABEL  = Object.fromEntries(ESTADOS);
const CIVIL_LABEL   = Object.fromEntries(ESTADOS_CIVIL);

const SECCIONES = [
  { key: 'generales',  label: 'Datos Generales',     icon: 'bi-person-vcard' },
  { key: 'familiares', label: 'Datos Familiares',    icon: 'bi-people'      },
  { key: 'laboral',    label: 'Académico Laboral',   icon: 'bi-briefcase'   },
  { key: 'eclesiastico', label: 'Datos Eclesiásticos', icon: 'bi-cross'       },
];

// ── Estado vacío del formulario ─────────────────────────────────────────────
const TERCERO_VACIO = {
  cedula: '', tipo_documento: '', tipo_persona: 'N',
  nombre1: '', nombre2: '', apellido1: '', apellido2: '',
  lugar_exp_cedula: '', fecha_nacimiento: '', lugar_nacimiento: '',
  sexo: '', direccion: '', barrio: '', municipio: '', departamento: '', distrito: '',
  telefono1: '', telefono2: '', celular: '', email: '', comentarios: '',
};

const FORM_VACIO = {
  tercero: { ...TERCERO_VACIO },
  estado_civil: '', fecha_matrimonio: '', tipo_matrimonio: '',
  lugar_matrimonio: '', nombre_oficiado_por: '', nombre_papa: '', nombre_mama: '',
  nombre_conyuge: '', personas_a_cargo: 0, comentario_familiar: '',
  folio_reg_civil: '', oficina_reg_civil: '', lugar_fallecimiento: '', fecha_fallecido: '',
  escolaridad: '', profesion: '', ocupacion: '', lugar_de_trabajo: '',
  telefono_trabajo: '', comentarios_academico_laboral: '',
  estado: '1', comentarios_eclesiales: '',
  congregacion: '', congregacion_nombre: '',
  foto: '',
  sw_bautizado: false, serial_bautismo: '', fecha_bautismo: '',
  lugar_bautismo: '', pastor_que_bautizo: '',
  sw_promesado: false, serial_membresia: '', fecha_promesado: '', lugar_promesado: '',
  congregacion_anterior: '', salio_para: '', fecha_llegada: '', fecha_salida: '',
};

const COLUMNAS = [
  { label: 'Foto',        campo: 'foto',            orden: null },
  { label: 'Cédula',      campo: 'cedula',          orden: 'tercero__cedula' },
  { label: 'Nombre',      campo: 'nombre_completo',   orden: 'tercero__apellido1' },
  { label: 'Estado',      campo: 'estado',            orden: 'estado' },
  { label: 'Congregación', campo: 'congregacion_nombre', orden: null },
  { label: 'Est. civil',  campo: 'estado_civil',      orden: 'estado_civil' },
  { label: 'F. bautismo', campo: 'fecha_bautismo',    orden: 'fecha_bautismo' },
  { label: 'Celular',     campo: 'celular',           orden: null },
];

const CAMPOS_FECHA = [
  'fecha_matrimonio', 'fecha_fallecido', 'fecha_bautismo',
  'fecha_promesado', 'fecha_llegada', 'fecha_salida',
];

// ── Controles de formulario ─────────────────────────────────────────────────
function Campo({ label, children, ancho = 'col-md-3' }) {
  return (
    <div className={ancho}>
      <label className="form-label small fw-semibold">{label}</label>
      {children}
    </div>
  );
}
function Texto({ value, onChange, ...props }) {
  return (
    <input className="form-control" value={value ?? ''} maxLength={30}
      onChange={e => onChange(e.target.value)} {...props} />
  );
}
function Fecha({ value, onChange }) {
  return (
    <input type="date" className="form-control" value={value ?? ''}
      onChange={e => onChange(e.target.value)} />
  );
}
function Lista({ value, onChange, opciones, placeholder = '—' }) {
  return (
    <select className="form-select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {opciones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
function Area({ value, onChange, rows = 2 }) {
  return (
    <textarea className="form-control" rows={rows} value={value ?? ''}
      onChange={e => onChange(e.target.value)} />
  );
}
function Interruptor({ checked, onChange, label }) {
  return (
    <div className="form-check form-switch mt-4">
      <input className="form-check-input" type="checkbox" checked={!!checked}
        onChange={e => onChange(e.target.checked)} id={label} />
      <label className="form-check-label small fw-semibold" htmlFor={label}>{label}</label>
    </div>
  );
}

// ── Sección 1 · Datos generales (alimentan accounting.Tercero) ──────────────
function SeccionGenerales({ t, setT, cedulaEstado, terceroInfo, editando, consultarCedula, abrirSelector, abrirMembresiaExistente }) {
  const avisoCedula = {
    encontrado: {
      clase: 'alert-success', icono: 'bi-check-circle',
      texto: terceroInfo ? `Tercero encontrado: ${terceroInfo.nombre_completo}. Los datos generales se sincronizarán al guardar.` : '',
    },
    nuevo: {
      clase: 'alert-info', icono: 'bi-info-circle',
      texto: 'Esta cédula no existe en Terceros. Se creará automáticamente al guardar (tipo de persona: Natural).',
    },
    ya_existe_membresia: {
      clase: 'alert-warning', icono: 'bi-exclamation-triangle',
      texto: 'Esta cédula ya tiene una membresía registrada.',
    },
    dada_de_baja: {
      clase: 'alert-warning', icono: 'bi-archive',
      texto: 'Esta cédula tiene una membresía que fue dada de baja. No se puede crear otra; ' +
             'contacte al administrador para restaurarla.',
    },
    error: { clase: 'alert-danger', icono: 'bi-x-circle', texto: 'No se pudo consultar la cédula.' },
  }[cedulaEstado];

  return (
    <>
      {avisoCedula && (
        <div className={`alert ${avisoCedula.clase} d-flex align-items-center gap-2 py-2 small`}>
          <i className={`bi ${avisoCedula.icono}`}></i>
          <span className="flex-grow-1">{avisoCedula.texto}</span>
          {cedulaEstado === 'ya_existe_membresia' && (
            <button type="button" className="btn btn-sm btn-outline-dark" onClick={abrirMembresiaExistente}>
              Abrir registro
            </button>
          )}
        </div>
      )}

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-shield-check me-2"></i>Identificación
      </h6>
      <div className="row g-3 mb-4">
        <Campo label={editando ? 'Cédula' : 'Cédula *'} ancho="col-md-3">
          <div className="input-group">
            <input className="form-control" value={t.cedula} maxLength={12} required
              disabled={!!editando}
              onChange={e => { setT('cedula', e.target.value); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); consultarCedula(); } }} />
            {!editando && (
              <button type="button" className="btn btn-outline-success"
                onClick={abrirSelector}
                title="Buscar tercero por cédula o nombre">
                <i className="bi bi-search"></i>
              </button>
            )}
          </div>
        </Campo>
        <Campo label="Tipo documento" ancho="col-md-2">
          <Texto value={t.tipo_documento} onChange={v => setT('tipo_documento', v)} maxLength={2} />
        </Campo>
        <Campo label="Lugar expedición" ancho="col-md-3">
          <Texto value={t.lugar_exp_cedula} onChange={v => setT('lugar_exp_cedula', v)} />
        </Campo>
        <Campo label="Tipo persona" ancho="col-md-2">
          <Lista value={t.tipo_persona} onChange={v => setT('tipo_persona', v)}
            opciones={[['N', 'Natural'], ['J', 'Jurídica']]} />
        </Campo>
        <Campo label="Sexo" ancho="col-md-2">
          <Lista value={t.sexo} onChange={v => setT('sexo', v)} opciones={SEXOS} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-person me-2"></i>Nombres y apellidos
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Primer nombre"><Texto value={t.nombre1} onChange={v => setT('nombre1', v)} /></Campo>
        <Campo label="Segundo nombre"><Texto value={t.nombre2} onChange={v => setT('nombre2', v)} /></Campo>
        <Campo label="Primer apellido"><Texto value={t.apellido1} onChange={v => setT('apellido1', v)} /></Campo>
        <Campo label="Segundo apellido"><Texto value={t.apellido2} onChange={v => setT('apellido2', v)} /></Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-calendar-event me-2"></i>Nacimiento
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Fecha de nacimiento"><Fecha value={t.fecha_nacimiento} onChange={v => setT('fecha_nacimiento', v)} /></Campo>
        <Campo label="Lugar de nacimiento" ancho="col-md-6">
          <Texto value={t.lugar_nacimiento} onChange={v => setT('lugar_nacimiento', v)} maxLength={100} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-geo-alt me-2"></i>Ubicación y contacto
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Dirección" ancho="col-md-6">
          <Texto value={t.direccion} onChange={v => setT('direccion', v)} maxLength={200} />
        </Campo>
        <Campo label="Barrio" ancho="col-md-3"><Texto value={t.barrio} onChange={v => setT('barrio', v)} /></Campo>
        <Campo label="Departamento" ancho="col-md-2">
          <Texto value={t.departamento} onChange={v => setT('departamento', v)} maxLength={2} />
        </Campo>
        <Campo label="Municipio" ancho="col-md-2">
          <Texto value={t.municipio} onChange={v => setT('municipio', v)} maxLength={3} />
        </Campo>
        <Campo label="Distrito" ancho="col-md-2">
          <Texto value={t.distrito} onChange={v => setT('distrito', v)} maxLength={2} />
        </Campo>
        <Campo label="Teléfono 1"><Texto value={t.telefono1} onChange={v => setT('telefono1', v)} maxLength={30} /></Campo>
        <Campo label="Teléfono 2"><Texto value={t.telefono2} onChange={v => setT('telefono2', v)} maxLength={20} /></Campo>
        <Campo label="Celular"><Texto value={t.celular} onChange={v => setT('celular', v)} maxLength={20} /></Campo>
        <Campo label="Email"><Texto type="email" value={t.email} onChange={v => setT('email', v)} maxLength={80} /></Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-card-list me-2"></i>Comentarios
      </h6>
      <div className="row g-3">
        <div className="col-12">
          <Area value={t.comentarios} onChange={v => setT('comentarios', v)} />
        </div>
      </div>
    </>
  );
}

// ── Sección 2 · Datos familiares ────────────────────────────────────────────
function SeccionFamiliares({ f, set }) {
  return (
    <>
      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-person-vcard me-2"></i>Estado civil y matrimonio
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Estado civil" ancho="col-md-4">
          <Lista value={f.estado_civil} onChange={v => set('estado_civil', v)} opciones={ESTADOS_CIVIL} />
        </Campo>
        <Campo label="Fecha de matrimonio" ancho="col-md-4">
          <Fecha value={f.fecha_matrimonio} onChange={v => set('fecha_matrimonio', v)} />
        </Campo>
        <Campo label="Tipo de matrimonio" ancho="col-md-4">
          <Lista value={f.tipo_matrimonio} onChange={v => set('tipo_matrimonio', v)} opciones={TIPOS_MATRIMONIO} />
        </Campo>
        <Campo label="Lugar de matrimonio" ancho="col-md-6">
          <Texto value={f.lugar_matrimonio} onChange={v => set('lugar_matrimonio', v)} />
        </Campo>
        <Campo label="Oficiado por" ancho="col-md-6">
          <Texto value={f.nombre_oficiado_por} onChange={v => set('nombre_oficiado_por', v)} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-people me-2"></i>Familia
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Nombre del papá"><Texto value={f.nombre_papa} onChange={v => set('nombre_papa', v)} /></Campo>
        <Campo label="Nombre de la mamá"><Texto value={f.nombre_mama} onChange={v => set('nombre_mama', v)} /></Campo>
        <Campo label="Nombre del cónyuge"><Texto value={f.nombre_conyuge} onChange={v => set('nombre_conyuge', v)} /></Campo>
        <Campo label="Personas a cargo" ancho="col-md-2">
          <input type="number" min="0" className="form-control" value={f.personas_a_cargo}
            onChange={e => set('personas_a_cargo', e.target.value)} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-file-earmark-text me-2"></i>Registro civil
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Folio registro civil" ancho="col-md-4">
          <Texto value={f.folio_reg_civil} onChange={v => set('folio_reg_civil', v)} maxLength={12} />
        </Campo>
        <Campo label="Oficina de registro civil" ancho="col-md-8">
          <Texto value={f.oficina_reg_civil} onChange={v => set('oficina_reg_civil', v)} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-flower1 me-2"></i>Fallecimiento
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Fecha de fallecimiento" ancho="col-md-4">
          <Fecha value={f.fecha_fallecido} onChange={v => set('fecha_fallecido', v)} />
        </Campo>
        <Campo label="Lugar de fallecimiento" ancho="col-md-8">
          <Texto value={f.lugar_fallecimiento} onChange={v => set('lugar_fallecimiento', v)} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-chat-left-text me-2"></i>Comentarios familiares
      </h6>
      <div className="row g-3">
        <div className="col-12"><Area value={f.comentario_familiar} onChange={v => set('comentario_familiar', v)} /></div>
      </div>
    </>
  );
}

// ── Sección 3 · Datos académicos y laborales ───────────────────────────────
function SeccionLaboral({ f, set }) {
  return (
    <>
      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-mortarboard me-2"></i>Formación académica
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Escolaridad" ancho="col-md-6">
          <Texto value={f.escolaridad} onChange={v => set('escolaridad', v)} />
        </Campo>
        <Campo label="Profesión" ancho="col-md-6">
          <Texto value={f.profesion} onChange={v => set('profesion', v)} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-briefcase me-2"></i>Información laboral
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Ocupación" ancho="col-md-6">
          <Texto value={f.ocupacion} onChange={v => set('ocupacion', v)} />
        </Campo>
        <Campo label="Lugar de trabajo" ancho="col-md-6">
          <Texto value={f.lugar_de_trabajo} onChange={v => set('lugar_de_trabajo', v)} />
        </Campo>
        <Campo label="Teléfono de trabajo" ancho="col-md-4">
          <Texto value={f.telefono_trabajo} onChange={v => set('telefono_trabajo', v)} maxLength={20} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-chat-left-text me-2"></i>Comentarios académico laboral
      </h6>
      <div className="row g-3">
        <div className="col-12">
          <Area value={f.comentarios_academico_laboral}
            onChange={v => set('comentarios_academico_laboral', v)} />
        </div>
      </div>
    </>
  );
}

// ── Sección 4 · Datos eclesiásticos ─────────────────────────────────────────
function SeccionEclesiastica({ f, set, setLupaCongregacion }) {
  return (
    <>
      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-person-check me-2"></i>Situación en la congregación
      </h6>
      <div className="row g-3 mb-4">
        <Campo label="Estado" ancho="col-md-4">
          <Lista value={f.estado} onChange={v => set('estado', v)} opciones={ESTADOS} placeholder="Seleccione" />
        </Campo>
        <Campo label="Congregación" ancho="col-md-8">
          {f.congregacion
            ? (
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <span className="badge bg-dark font-monospace me-1">{f.congregacion}</span>
                  {f.congregacion_nombre || <span className="text-muted fst-italic">sin nombre</span>}
                </span>
                <button type="button" className="btn btn-outline-secondary"
                  onClick={() => set('congregacion', '')} title="Cambiar congregación">
                  <i className="bi bi-arrow-repeat"></i>
                </button>
                <button type="button" className="btn btn-outline-danger"
                  onClick={() => { set('congregacion', ''); set('congregacion_nombre', ''); }}
                  title="Quitar congregación">
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            )
            : (
              <button type="button" className="btn btn-outline-primary w-100"
                onClick={() => setLupaCongregacion(true)}>
                <i className="bi bi-search me-1"></i>Buscar congregación
              </button>
            )}
        </Campo>
        <Campo label="Fecha de llegada" ancho="col-md-4">
          <Fecha value={f.fecha_llegada} onChange={v => set('fecha_llegada', v)} />
        </Campo>
        <Campo label="Fecha de salida" ancho="col-md-4">
          <Fecha value={f.fecha_salida} onChange={v => set('fecha_salida', v)} />
        </Campo>
        <Campo label="Congregación anterior" ancho="col-md-4">
          <Texto value={f.congregacion_anterior} onChange={v => set('congregacion_anterior', v)} />
        </Campo>
        <Campo label="Salió para" ancho="col-md-4">
          <Texto value={f.salio_para} onChange={v => set('salio_para', v)} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-water me-2"></i>Bautismo
      </h6>
      <div className="row g-3 mb-4">
        <div className="col-md-4"><Interruptor checked={f.sw_bautizado} onChange={v => set('sw_bautizado', v)} label="¿Es bautizado?" /></div>
        <Campo label="Serial de bautismo" ancho="col-md-4" >
          <input type="number" className="form-control" value={f.serial_bautismo}
            onChange={e => set('serial_bautismo', e.target.value)} />
        </Campo>
        <Campo label="Fecha de bautismo" ancho="col-md-4">
          <Fecha value={f.fecha_bautismo} onChange={v => set('fecha_bautismo', v)} />
        </Campo>
        <Campo label="Lugar de bautismo" ancho="col-md-6">
          <Texto value={f.lugar_bautismo} onChange={v => set('lugar_bautismo', v)} />
        </Campo>
        <Campo label="Pastor que bautizó" ancho="col-md-6">
          <Texto value={f.pastor_que_bautizo} onChange={v => set('pastor_que_bautizo', v)} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-snow2 me-2"></i>Promesa (bautismo con Espíritu Santo)
      </h6>
      <div className="row g-3 mb-4">
        <div className="col-md-4"><Interruptor checked={f.sw_promesado} onChange={v => set('sw_promesado', v)} label="¿Es promesado?" /></div>
        <Campo label="Serial de membresía" ancho="col-md-4">
          <input type="number" className="form-control" value={f.serial_membresia}
            onChange={e => set('serial_membresia', e.target.value)} />
        </Campo>
        <Campo label="Fecha de promesa" ancho="col-md-4">
          <Fecha value={f.fecha_promesado} onChange={v => set('fecha_promesado', v)} />
        </Campo>
        <Campo label="Lugar de promesa" ancho="col-md-6">
          <Texto value={f.lugar_promesado} onChange={v => set('lugar_promesado', v)} />
        </Campo>
      </div>

      <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
        <i className="bi bi-chat-left-text me-2"></i>Comentarios eclesiales
      </h6>
      <div className="row g-3">
        <div className="col-12">
          <Area value={f.comentarios_eclesiales} onChange={v => set('comentarios_eclesiales', v)} />
        </div>
      </div>
    </>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
export default function MembresiaPage() {
  const location = useLocation();
  const { canAdd, canEdit, canDel } = usePerm(location.pathname);

  const [membresias, setMembresias] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [total,    setTotal]    = useState(0);
  const [pagina,   setPagina]   = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [orden,    setOrden]    = useState(null);
  const [filtros,  setFiltros]  = useState({ estado: '', bautizados: '', promesados: '' });

  const [modal,        setModal]        = useState(false);
  const [editando,     setEditando]     = useState(null);
  const [form,         setForm]         = useState(FORM_VACIO);
  const [tab,          setTab]          = useState('generales');
  const [cedulaEstado, setCedulaEstado] = useState('');
  const [terceroInfo,  setTerceroInfo]  = useState(null);
  const [buscando,     setBuscando]     = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [lupaCongregacion, setLupaCongregacion] = useState(false);

  // Foto del miembro (Cloudinary)
  const [fotoFile,     setFotoFile]     = useState(null);   // archivo pendiente (registro nuevo)
  const [fotoPreview,  setFotoPreview]  = useState('');     // URL local para previsualización
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE };
    if (busqueda)  params.search = busqueda;
    if (orden)     params.ordering = (orden.dir === 'desc' ? '-' : '') + orden.campo;
    if (filtros.estado)     params.estado = filtros.estado;
    if (filtros.bautizados) params.solo_bautizados = filtros.bautizados;
    if (filtros.promesados) params.solo_promesados = filtros.promesados;
    getMembresias(params)
      .then(r => {
        setMembresias(r.data.results || r.data);
        setTotal(r.data.count || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pagina, busqueda, orden, filtros]);

  useEffect(() => { cargar(); }, [cargar]);

  const sortOn = (campo) => {
    if (!campo) return;
    setOrden(prev => {
      if (!prev || prev.campo !== campo) return { campo, dir: 'asc' };
      if (prev.dir === 'asc') return { campo, dir: 'desc' };
      return null;
    });
    setPagina(1);
  };

  const set = (campo, valor) => setForm(p => ({ ...p, [campo]: valor }));
  const setT = (campo, valor) => setForm(p => ({ ...p, tercero: { ...p.tercero, [campo]: valor } }));

  const limpiarCedula = () => {
    setCedulaEstado('');
    setTerceroInfo(null);
  };

  const limpiarFoto = () => {
    setFotoFile(null);
    setFotoPreview('');
  };

  const elegirFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Formato no permitido. Use JPG, PNG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera el tamaño máximo (5 MB).');
      return;
    }
    if (editando) {
      // Ya existe la membresía: se sube de inmediato.
      setSubiendoFoto(true);
      try {
        const { data } = await subirFotoMembresia(editando.id, file);
        setForm(p => ({ ...p, foto: data.foto }));
        setEditando(p => ({ ...p, foto: data.foto }));
        toast.success('Foto actualizada');
      } catch (err) {
        toast.error(err.response?.data?.detail || 'No se pudo subir la foto');
      } finally {
        setSubiendoFoto(false);
      }
    } else {
      // Registro nuevo: se guarda y se sube al crear.
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const quitarFoto = async () => {
    if (editando && form.foto) {
      if (!window.confirm('¿Eliminar la foto de esta membresía?')) return;
      setSubiendoFoto(true);
      try {
        await eliminarFotoMembresia(editando.id);
        setForm(p => ({ ...p, foto: '' }));
        setEditando(p => ({ ...p, foto: '' }));
        limpiarFoto();
        toast.success('Foto eliminada');
      } catch {
        toast.error('No se pudo eliminar la foto');
      } finally {
        setSubiendoFoto(false);
      }
    } else {
      limpiarFoto();
    }
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...FORM_VACIO, tercero: { ...TERCERO_VACIO } });
    setTab('generales');
    limpiarCedula();
    limpiarFoto();
    setModal(true);
  };

  const abrirEditar = (m) => {
    setEditando(m);
    setForm({
      tercero: {
        cedula: m.tercero.cedula, tipo_documento: m.tercero.tipo_documento || '',
        tipo_persona: m.tercero.tipo_persona || 'N',
        nombre1: m.tercero.nombre1 || '', nombre2: m.tercero.nombre2 || '',
        apellido1: m.tercero.apellido1 || '', apellido2: m.tercero.apellido2 || '',
        lugar_exp_cedula: m.tercero.lugar_exp_cedula || '',
        fecha_nacimiento: m.tercero.fecha_nacimiento || '',
        lugar_nacimiento: m.tercero.lugar_nacimiento || '',
        sexo: m.tercero.sexo || '', direccion: m.tercero.direccion || '',
        barrio: m.tercero.barrio || '', municipio: m.tercero.municipio || '',
        departamento: m.tercero.departamento || '', distrito: m.tercero.distrito || '',
        telefono1: m.tercero.telefono1 || '', telefono2: m.tercero.telefono2 || '',
        celular: m.tercero.celular || '', email: m.tercero.email || '',
        comentarios: m.tercero.comentarios || '',
      },
      estado_civil: m.estado_civil || '', fecha_matrimonio: m.fecha_matrimonio || '',
      tipo_matrimonio: m.tipo_matrimonio || '', lugar_matrimonio: m.lugar_matrimonio || '',
      nombre_oficiado_por: m.nombre_oficiado_por || '', nombre_papa: m.nombre_papa || '',
      nombre_mama: m.nombre_mama || '', nombre_conyuge: m.nombre_conyuge || '',
      personas_a_cargo: m.personas_a_cargo ?? 0, comentario_familiar: m.comentario_familiar || '',
      folio_reg_civil: m.folio_reg_civil || '', oficina_reg_civil: m.oficina_reg_civil || '',
      lugar_fallecimiento: m.lugar_fallecimiento || '', fecha_fallecido: m.fecha_fallecido || '',
      escolaridad: m.escolaridad || '', profesion: m.profesion || '',
      ocupacion: m.ocupacion || '', lugar_de_trabajo: m.lugar_de_trabajo || '',
      telefono_trabajo: m.telefono_trabajo || '',
      comentarios_academico_laboral: m.comentarios_academico_laboral || '',
      estado: m.estado || '1', comentarios_eclesiales: m.comentarios_eclesiales || '',
      congregacion: m.congregacion || '',
      congregacion_nombre: m.congregacion_nombre || '',
      foto: m.foto || '',
      sw_bautizado: !!m.sw_bautizado, serial_bautismo: m.serial_bautismo ?? '',
      fecha_bautismo: m.fecha_bautismo || '', lugar_bautismo: m.lugar_bautismo || '',
      pastor_que_bautizo: m.pastor_que_bautizo || '',
      sw_promesado: !!m.sw_promesado, serial_membresia: m.serial_membresia ?? '',
      fecha_promesado: m.fecha_promesado || '', lugar_promesado: m.lugar_promesado || '',
      congregacion_anterior: m.congregacion_anterior || '', salio_para: m.salio_para || '',
      fecha_llegada: m.fecha_llegada || '', fecha_salida: m.fecha_salida || '',
    });
    setTab('generales');
    limpiarCedula();
    limpiarFoto();
    setModal(true);
  };

  // ── Consultar cédula en Terceros ────────────────────────────────────────
  const cargarTercero = async (cedula) => {
    if (!cedula || editando) return;
    setBuscando(true);
    try {
      const r = await buscarTerceroPorCedula(cedula);
      if (!r.data.existe) {
        setCedulaEstado('nuevo');
        setTerceroInfo(null);
        return;
      }
      if (r.data.membresia_dada_de_baja) {
        setCedulaEstado('dada_de_baja');
        setTerceroInfo(r.data.tercero);
        return;
      }
      if (r.data.ya_tiene_membresia) {
        setCedulaEstado('ya_existe_membresia');
        setTerceroInfo(r.data.tercero);
        return;
      }
      const { nombre_completo, ...datos } = r.data.tercero;
      setTerceroInfo({ ...datos, nombre_completo });
      setCedulaEstado('encontrado');
      setForm(p => ({ ...p, tercero: { ...TERCERO_VACIO, ...datos, cedula } }));
      setTab('generales');
      toast.success(`Tercero cargado: ${nombre_completo}`);
    } catch (e) {
      setCedulaEstado('error');
      const detalle = e?.response?.data?.detail || e?.message || 'sin detalle';
      toast.error(`No se pudo consultar la cédula: ${detalle}`);
    } finally {
      setBuscando(false);
    }
  };

  const consultarCedula = () => cargarTercero(form.tercero.cedula.trim());

  const abrirSelector = () => setSelectorAbierto(true);

  const elegirTercero = (t, yaTieneMembresia) => {
    if (yaTieneMembresia) {
      toast.error('Esa cédula ya tiene una membresía registrada');
      abrirMembresiaExistentePorCedula(t.cedula);
      return;
    }
    cargarTercero(t.cedula);
  };

  const abrirMembresiaExistentePorCedula = async (cedula) => {
    if (!cedula) return;
    try {
      const r = await getMembresias({ search: cedula, page_size: 20 });
      const lista = r.data.results || r.data;
      const encontrado = lista.find(m => m.tercero.cedula === cedula);
      if (encontrado) {
        setModal(false);
        abrirEditar(encontrado);
      } else {
        toast.error('No se encontró una membresía activa para esa cédula');
      }
    } catch {
      toast.error('Error al buscar la membresía');
    }
  };

  const abrirMembresiaExistente = () =>
    abrirMembresiaExistentePorCedula(form.tercero.cedula.trim());

  // ── Guardar ────────────────────────────────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault();
    if (cedulaEstado === 'ya_existe_membresia') {
      toast.error('Esta cédula ya tiene una membresía registrada');
      return;
    }
    if (cedulaEstado === 'dada_de_baja') {
      toast.error('Esta cédula tiene una membresía dada de baja');
      return;
    }
    const aNum = (v) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10));
    const payload = { ...form };
    CAMPOS_FECHA.forEach(k => { if (payload[k] === '') payload[k] = null; });
    if (payload.tercero.fecha_nacimiento === '') payload.tercero.fecha_nacimiento = null;
    payload.tercero.cedula = form.tercero.cedula.trim();
    // congregacion_nombre es solo lectura: lo calcula el backend
    delete payload.congregacion_nombre;
    payload.congregacion = form.congregacion || null;
    payload.personas_a_cargo  = aNum(form.personas_a_cargo) ?? 0;
    payload.serial_bautismo   = aNum(form.serial_bautismo);
    payload.serial_membresia  = aNum(form.serial_membresia);

    try {
      if (editando) { await updateMembresia(editando.id, payload); toast.success('Membresía actualizada'); }
      else {
        const { data } = await createMembresia(payload);
        if (fotoFile && data?.id) {
          try { await subirFotoMembresia(data.id, fotoFile); }
          catch { toast.error('La membresía se creó, pero la foto no se pudo subir'); }
        }
        toast.success('Membresía creada');
      }
      setModal(false);
      cargar();
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.tercero?.cedula?.[0] || d?.detail ||
        (typeof d === 'object' ? Object.values(d || {}).flat()[0] : null) || 'Error al guardar';
      toast.error(msg);
    }
  };

  const eliminar = async (m) => {
    if (!window.confirm(`¿Eliminar la membresía de ${m.nombre_completo}?`)) return;
    try {
      await deleteMembresia(m.id);
      toast.success('Membresía eliminada');
      cargar();
    } catch {
      toast.error('No se puede eliminar esta membresía');
    }
  };

  const hayFiltros = filtros.estado || filtros.bautizados || filtros.promesados;
  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  return (
    <MainLayout>
      <TopBar title="Membresía" />
      <div className="p-4">
        <PageHeader title="Membresías" subtitle={`${total} registro(s) · datos eclesiales de la congregación`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-person-plus me-1"></i>Nueva membresía
          </button>
        </PageHeader>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="input-group" style={{ maxWidth: 380 }}>
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input className="form-control" placeholder="Buscar por cédula o nombre..."
                  value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
                {busqueda && (
                  <button className="btn btn-outline-secondary" onClick={() => setBusqueda('')}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
              <select className="form-select form-select-sm" style={{ maxWidth: 180 }}
                value={filtros.estado} onChange={e => { setFiltros(p => ({ ...p, estado: e.target.value })); setPagina(1); }}>
                <option value="">Todos los estados</option>
                {ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="btn-group btn-group-sm">
                <button className={`btn ${filtros.bautizados === '1' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => { setFiltros(p => ({ ...p, bautizados: p.bautizados === '1' ? '' : '1' })); setPagina(1); }}>
                  <i className="bi bi-water me-1"></i>Bautizados
                </button>
                <button className={`btn ${filtros.promesados === '1' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => { setFiltros(p => ({ ...p, promesados: p.promesados === '1' ? '' : '1' })); setPagina(1); }}>
                  <i className="bi bi-snow2 me-1"></i>Promesados
                </button>
              </div>
              {hayFiltros && (
                <button className="btn btn-sm btn-outline-danger"
                  onClick={() => { setFiltros({ estado: '', bautizados: '', promesados: '' }); setPagina(1); }}>
                  <i className="bi bi-x-circle me-1"></i>Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          {loading ? <div className="p-4"><Spinner /></div> : (
            <div className="table-responsive" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
              <table className="table table-hover table-sm mb-0">
                <thead className="table-dark" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    {COLUMNAS.map(c => (
                      <th key={c.campo} onClick={() => sortOn(c.orden)}
                        style={{ cursor: c.orden ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                        {c.label}
                        {orden?.campo === c.orden && (
                          <span className="ms-1">{orden.dir === 'asc' ? '\u25B2' : '\u25BC'}</span>
                        )}
                      </th>
                    ))}
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {membresias.length === 0 && (
                    <tr><td colSpan={COLUMNAS.length + 1} className="text-center text-muted py-4">
                      No hay membresías que coincidan con los filtros
                    </td></tr>
                  )}
                  {membresias.map(m => (
                    <tr key={m.id}>
                      <td style={{ width: 48 }}>
                        {m.foto
                          ? <img src={m.foto} alt="" className="rounded border"
                              style={{ width: 33, height: 44, objectFit: 'cover' }} />
                          : <i className="bi bi-person-circle text-muted" style={{ fontSize: 24 }}></i>}
                      </td>
                      <td><code className="small">{m.tercero.cedula}</code></td>
                      <td className="small">{m.nombre_completo}</td>
                      <td>
                        <span className={`badge bg-${ESTADO_COLOR[m.estado] || 'secondary'}`}>
                          {ESTADO_LABEL[m.estado] || '—'}
                        </span>
                      </td>
                      <td className="small">
                        {m.congregacion
                          ? <><span className="badge bg-dark font-monospace me-1">{m.congregacion}</span>
                             {m.congregacion_nombre || '—'}</>
                          : <span className="fst-italic">—</span>}
                      </td>
                      <td className="small">{CIVIL_LABEL[m.estado_civil] || '—'}</td>
                      <td className="small">{m.fecha_bautismo || '—'}</td>
                      <td className="small">{m.tercero.celular || '—'}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => abrirEditar(m)}
                            disabled={!canEdit} title="Editar">
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger" onClick={() => eliminar(m)}
                            disabled={!canDel} title="Eliminar">
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPaginas > 1 && (
            <div className="card-footer d-flex justify-content-between align-items-center">
              <span className="small text-muted">Página {pagina} de {totalPaginas}</span>
              <div className="btn-group btn-group-sm">
                <button className="btn btn-outline-secondary" disabled={pagina === 1}
                  onClick={() => setPagina(p => p - 1)}><i className="bi bi-chevron-left"></i></button>
                <button className="btn btn-outline-secondary" disabled={pagina >= totalPaginas}
                  onClick={() => setPagina(p => p + 1)}><i className="bi bi-chevron-right"></i></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-person-badge me-2"></i>
                  {editando ? 'Editar membresía' : 'Nueva membresía'}
                </h5>
                <button type="button" className="btn-close btn-close-white"
                  onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                  {/* Foto del miembro (Cloudinary) */}
                  <div className="d-flex align-items-center gap-3 mb-3 p-2 border rounded bg-light">
                    <div className="flex-shrink-0">
                      {(fotoPreview || form.foto) ? (
                        <img src={fotoPreview || form.foto} alt="Foto del miembro"
                          style={{ width: 66, height: 88, objectFit: 'cover', borderRadius: 6 }}
                          className="border" />
                      ) : (
                        <div className="d-flex align-items-center justify-content-center border rounded bg-white text-muted"
                          style={{ width: 66, height: 88 }}>
                          <i className="bi bi-person-bounding-box" style={{ fontSize: 30 }}></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold small mb-1">Foto del miembro</div>
                      <div className="text-muted" style={{ fontSize: '.78rem' }}>
                        Foto tipo documento (3×4 cm) · JPG, PNG o WebP · máx. 5 MB
                        {!editando && fotoFile && ' · se subirá al guardar'}
                      </div>
                      <div className="d-flex gap-2 mt-2">
                        <label htmlFor="mem_foto_input"
                          className={`btn btn-sm btn-outline-success mb-0 ${subiendoFoto ? 'disabled' : ''}`}>
                          {subiendoFoto
                            ? <><span className="spinner-border spinner-border-sm me-1"></span>Subiendo...</>
                            : <><i className="bi bi-upload me-1"></i>{form.foto || fotoPreview ? 'Cambiar' : 'Subir'}</>}
                        </label>
                        <input id="mem_foto_input" type="file" className="d-none"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={elegirFoto} disabled={subiendoFoto} />
                        {(form.foto || fotoPreview) && !subiendoFoto && (
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={quitarFoto}>
                            <i className="bi bi-trash me-1"></i>Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <ul className="nav nav-tabs mb-3" role="tablist">
                    {SECCIONES.map(s => (
                      <li className="nav-item" key={s.key}>
                        <button type="button" role="tab"
                          aria-selected={tab === s.key}
                          className={`nav-link ${tab === s.key ? 'active' : ''}`}
                          onClick={() => setTab(s.key)}>
                          <i className={`bi ${s.icon} me-1`}></i>{s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="tab-content">
                    {tab === 'generales' && (
                      <SeccionGenerales
                        t={form.tercero} setT={setT}
                        cedulaEstado={cedulaEstado} terceroInfo={terceroInfo}
                        editando={editando}
                        consultarCedula={consultarCedula}
                        abrirSelector={abrirSelector}
                        abrirMembresiaExistente={abrirMembresiaExistente} />
                    )}
                    {tab === 'familiares'   && <SeccionFamiliares   f={form} set={set} />}
                    {tab === 'laboral'      && <SeccionLaboral      f={form} set={set} />}
                    {tab === 'eclesiastico' && <SeccionEclesiastica f={form} set={set} setLupaCongregacion={setLupaCongregacion} />}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success"
                    disabled={editando ? !canEdit : !canAdd}>
                    <i className="bi bi-check2 me-1"></i>Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <SelectorTercero
        abierto={selectorAbierto}
        cedulaInicial={form.tercero.cedula}
        cargarReservados={getCedulasConMembresia}
        onCerrar={() => setSelectorAbierto(false)}
        onElegir={elegirTercero} />

      {/* Lupa de congregación — mismo recurso que usa el módulo de Congregaciones */}
      <SelectorCongregacion
        abierto={lupaCongregacion}
        codigoInicial={form.congregacion}
        onCerrar={() => setLupaCongregacion(false)}
        onElegir={c => setForm(f => ({
          ...f, congregacion: c.codigo, congregacion_nombre: c.nombre,
        }))} />
    </MainLayout>
  );
}
