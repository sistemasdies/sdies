import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import ModalBuscador from '../../components/common/ModalBuscador';
import { useBuscador } from '../../hooks/useBuscador';
import { createAsiento } from '../../api/asientos';
import { getComprobantes, getSiguienteNumero } from '../../api/comprobantes';
import { getCuentas } from '../../api/cuentas';
import { getTerceros } from '../../api/terceros';
import { getCentrosCosto } from '../../api/centrosCosto';
import { getPlantillas } from '../../api/plantillas';
import { formatMoney } from '../../utils/formato';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';
import { usePreferencias } from '../../hooks/usePreferencias';

const DIGIT  = 'DIGITE';
const esDig  = v => v?.toString().toUpperCase().trim() === DIGIT;

// ── Heredar campo vacío del renglón anterior ──────────────────────────────
const heredarAnterior = (detalles) => {
  const res = [];
  const ultimoReal = { cuenta:'', observacion:'', cedula:'', centro_costo:'' };

  for (let i = 0; i < detalles.length; i++) {
    const d = { ...detalles[i] };

    ['cuenta','observacion','cedula','centro_costo'].forEach(campo => {
      if (!d[campo]) {
        // Vacío → hereda el último valor real
        d[campo] = ultimoReal[campo] || '';
      } else if (!esDig(d[campo])) {
        // Valor propio real → actualiza ultimoReal
        ultimoReal[campo] = d[campo];
      }
      // DIGITE → no hereda, no actualiza ultimoReal
    });

    res.push(d);
  }
  return res;
};

// ── Construir pasos DIGITE para el wizard ─────────────────────────────────
const construirWizard = (lineas) => {
  const pasos = [];
  lineas.forEach((l, idx) => {
    const base = { lineaIdx: idx, lineaNum: idx + 1, total: lineas.length,
                   descripcionOriginal: l.descripcionOriginal || '' };
    if (esDig(l.cuenta))       pasos.push({ ...base, campo:'cuenta',       tipo:'cuenta',   label:'Cuenta contable'  });
    if (esDig(l.observacion))  pasos.push({ ...base, campo:'observacion',  tipo:'texto',    label:'Observación'      });
    if (esDig(l.cedula))       pasos.push({ ...base, campo:'cedula',       tipo:'tercero',  label:'Cédula / Tercero' });
    if (esDig(l.centro_costo)) pasos.push({ ...base, campo:'centro_costo', tipo:'cc',       label:'Centro de costo'  });
    if (esDig(l.vr_debitos))   pasos.push({ ...base, campo:'vr_debitos',   tipo:'monto',    label:'Valor débito'     });
    if (esDig(l.vr_creditos))  pasos.push({ ...base, campo:'vr_creditos',  tipo:'monto',    label:'Valor crédito'    });
  });
  return pasos;
};

export default function AsientoConPlantilla() {
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const { user }   = useAuth();
  const inputRef   = useRef(null);
  const listaRef   = useRef(null);
  const buscador   = useBuscador();        // ← hook F3
  const { canAdd, canDel } = usePerm(window.location.pathname);
  const { data: prefs, guardar: guardarPrefs, estaListo: prefsListo } = usePreferencias();

  // Catálogos
  const [comprobantes, setComprobantes] = useState([]);
  const [cuentas,      setCuentas]      = useState([]);
  const [terceros,     setTerceros]     = useState([]);
  const [centros,      setCentros]      = useState([]);
  const [plantillas,   setPlantillas]   = useState([]);

  // Cabecera
  const [cabecera, setCabecera] = useState({
    cod_comprob:'', fecha: new Date().toISOString().split('T')[0],
    doc_ref:'', doc_soporte:'',
  });

  // Líneas
  const [lineas, setLineas] = useState([]);

  // Flujo: seleccionar | wizard | formulario
  const [fase,             setFase]             = useState('seleccionar');
  const [plantillaId,      setPlantillaId]      = useState('');
  const [busquedaPlantilla,setBusquedaPlantilla] = useState('');
  const [sufijoComprob,   setSufijoComprob]    = useState('');
  const [cajaUser,         setCajaUser]         = useState('');
  const [numComprob,       setNumComprob]       = useState('');

  // Wizard
  const [pasos,      setPasos]      = useState([]);
  const [pasoActual, setPasoActual] = useState(0);
  const [valorWiz,   setValorWiz]   = useState('');
  const [errWiz,     setErrWiz]     = useState('');

  const [saving, setSaving] = useState(false);

  // ── Cargar catálogos ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.allSettled([
      getComprobantes(),
      getCuentas({ page_size: 5000 }),
      getTerceros({ page_size: 2000 }),
      getCentrosCosto(),
      getPlantillas(),
    ]).then(([c, cu, t, cc, pl]) => {
      if (c.status  === 'fulfilled') setComprobantes(c.value.data.results  || c.value.data);
      if (cu.status === 'fulfilled') setCuentas(     cu.value.data.results || cu.value.data);
      if (t.status  === 'fulfilled') setTerceros(    t.value.data.results  || t.value.data);
      if (cc.status === 'fulfilled') setCentros(     cc.value.data.results || cc.value.data);
      if (pl.status === 'fulfilled') setPlantillas(  pl.value.data.results || pl.value.data);
    });
  }, []);

  // Inicializar cajaUser desde el perfil del usuario
  useEffect(() => {
    if (user?.caja_user) setCajaUser(user.caja_user);
  }, [user]);

  // Auto-seleccionar plantilla desde URL
  useEffect(() => {
    const pid = searchParams.get('plantilla');
    if (pid && plantillas.length && !plantillaId) {
      const found = plantillas.find(p => p.id === pid || p.cod_plantilla === pid);
      if (found) setPlantillaId(found.id);
    }
  }, [searchParams, plantillas]);

  // Rehidratar plantilla + sufijo guardados (solo si no se viene por URL y aún en fase de selección)
  useEffect(() => {
    if (!prefsListo || !prefs || fase !== 'seleccionar') return;
    if (searchParams.get('plantilla')) return;
    const guardados = prefs['asiento_plantilla'];
    if (!guardados) return;
    if (guardados.plantillaId && !plantillaId) setPlantillaId(guardados.plantillaId);
    if (guardados.sufijoComprob) setSufijoComprob(guardados.sufijoComprob);
  }, [prefsListo]);

  // Persistir plantilla + sufijo en preferencias cada vez que cambian (con debounce sencillo)
  useEffect(() => {
    if (!guardarPrefs) return;
    const prefsAtrasadas = setTimeout(() => {
      guardarPrefs({ 'asiento_plantilla': { ...(prefs?.['asiento_plantilla'] || {}), plantillaId, sufijoComprob } });
    }, 600);
    return () => clearTimeout(prefsAtrasadas);
  }, [plantillaId, sufijoComprob]);

  // Scroll a la plantilla seleccionada
  useEffect(() => {
    if (plantillaId && listaRef.current) {
      const el = listaRef.current.querySelector(`[data-pid="${plantillaId}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [plantillaId]);

  useEffect(() => {
    if (fase === 'wizard' && inputRef.current)
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [pasoActual, fase]);

  // Obtener siguiente número de comprobante cuando cambia cod_comprob
  useEffect(() => {
    if (!cabecera.cod_comprob) { setNumComprob(''); return; }
    getSiguienteNumero(cabecera.cod_comprob)
      .then(r => setNumComprob(r.data.siguiente))
      .catch(() => setNumComprob(''));
  }, [cabecera.cod_comprob]);

  const plantillaActual = plantillas.find(p => p.id === plantillaId);

  // ── Aplicar plantilla ─────────────────────────────────────────────────
  const aplicarPlantilla = (override) => {
    const activa = override || plantillaActual;
    if (!activa?.detalles?.length) {
      toast.error('La plantilla no tiene líneas configuradas'); return;
    }
    const ordenados  = [...activa.detalles].sort((a,b) => a.item - b.item);
    const heredados  = heredarAnterior(ordenados);

    // Función auxiliar para reemplazar CajaUser en cualquier campo
    const resolverCaja = (val) =>
      val && val.toUpperCase() === 'CAJAUSER' ? cajaUser : val;

    const lineasBase = heredados.map(d => ({
      cuenta:              esDig(d.cuenta)       ? DIGIT : resolverCaja(d.cuenta       || ''),
      cuenta_desc:         '',
      observacion:         esDig(d.observacion)  ? DIGIT : resolverCaja(d.observacion  || ''),
      cedula:              esDig(d.cedula)        ? DIGIT : resolverCaja(d.cedula       || ''),
      tercero_nombre:      '',
      centro_costo:        esDig(d.centro_costo) ? DIGIT : resolverCaja(d.centro_costo || ''),
      vr_debitos:          d.tipo_mov==='D' ? (esDig(d.valor) ? DIGIT : (d.valor||'')) : '',
      vr_creditos:         d.tipo_mov==='C' ? (esDig(d.valor) ? DIGIT : (d.valor||'')) : '',
      tipo_mov:            d.tipo_mov || '',
      base:                d.base || '',
      descripcionOriginal: d.observacion || '',
      _fromPlantilla:      true,
    }));

    // Resolver cuentas fijas
    const lineasResueltas = lineasBase.map(l => {
      if (l.cuenta && !esDig(l.cuenta)) {
        const c = cuentas.find(c => c.codigo === l.cuenta);
        return { ...l, cuenta_desc: c ? c.descripcion : '' };
      }
      return l;
    });

    if (activa.comprobante)
      setCabecera(prev => ({ ...prev, cod_comprob: activa.comprobante + sufijoComprob }));

    // Restringir datos fuera del alcance del rol (catálogos ya vienen filtrados)
    const fueraCuentas = [...new Set(lineasResueltas
      .filter(l => l.cuenta && !esDig(l.cuenta) && !cuentas.some(c => c.codigo === l.cuenta))
      .map(l => l.cuenta))];
    const fueraCC = [...new Set(lineasResueltas
      .filter(l => l.centro_costo && !esDig(l.centro_costo) && !centros.some(c => c.codigo === l.centro_costo))
      .map(l => l.centro_costo))];
    if (fueraCuentas.length || fueraCC.length) {
      const partes = [];
      if (fueraCuentas.length) partes.push(`cuentas: ${fueraCuentas.join(', ')}`);
      if (fueraCC.length)      partes.push(`centros de costo: ${fueraCC.join(', ')}`);
      toast.error(`La plantilla "${activa.nombre}" usa datos no permitidos para su rol (${partes.join('; ')}).`);
      return;
    }

    setLineas(lineasResueltas);

    const wizardPasos = construirWizard(lineasResueltas);
    if (wizardPasos.length === 0) {
      setFase('formulario');
      toast.success(`Plantilla "${activa.nombre}" cargada`);
    } else {
      setPasos(wizardPasos);
      setPasoActual(0);
      setValorWiz('');
      setErrWiz('');
      setFase('wizard');
      toast(`Plantilla cargada — ${wizardPasos.length} campo(s) por completar`, { icon:'✏️' });
    }
  };

  // ── Wizard: validar y avanzar ─────────────────────────────────────────
  const avanzarWizard = () => {
    const paso = pasos[pasoActual];
    const val  = valorWiz.trim();
    if (!val) { setErrWiz('Este campo es obligatorio'); return; }
    if (paso.tipo === 'monto') {
      const n = parseFloat(val.replace(/,/g,'.'));
      if (isNaN(n)||n<0) { setErrWiz('Ingrese un valor numérico positivo'); return; }
    }
    if (paso.tipo === 'cuenta') {
      if (!cuentas.find(c => c.codigo === val))
        { setErrWiz(`No existe la cuenta "${val}"`); return; }
    }
    if (paso.tipo === 'tercero') {
      if (!terceros.find(t => t.cedula === val))
        { setErrWiz(`No existe el tercero con cédula "${val}"`); return; }
    }
    if (paso.tipo === 'cc') {
      if (!centros.find(c => c.codigo === val))
        { setErrWiz(`No existe el centro de costo "${val}"`); return; }
    }

    // Aplicar valor
    const nuevas = [...lineas];
    const l = { ...nuevas[paso.lineaIdx] };
    if (paso.campo === 'cuenta') {
      const c = cuentas.find(c => c.codigo === val);
      l.cuenta     = val;
      l.cuenta_desc= c ? c.descripcion : '';
    } else if (paso.campo === 'cedula') {
      const t = terceros.find(t => t.cedula === val);
      l.cedula         = val;
      l.tercero_nombre = t ? t.nombre_completo : '';
    } else if (paso.campo==='vr_debitos'||paso.campo==='vr_creditos') {
      l[paso.campo] = parseFloat(val.replace(/,/g,'.')).toFixed(2);
    } else {
      l[paso.campo] = val;
    }
    nuevas[paso.lineaIdx] = l;

    // Propagar valor a renglones siguientes que tengan campo vacío/0/DIGITE
    for (let i = paso.lineaIdx + 1; i < nuevas.length; i++) {
      const sig    = { ...nuevas[i] };
      const valSig = sig[paso.campo];
      if (!valSig || valSig === '0' || esDig(valSig)) {
        if (paso.campo === 'cuenta') {
          sig.cuenta      = nuevas[i-1].cuenta;
          sig.cuenta_desc = nuevas[i-1].cuenta_desc;
        } else if (paso.campo === 'cedula') {
          sig.cedula         = nuevas[i-1].cedula;
          sig.tercero_nombre = nuevas[i-1].tercero_nombre;
        } else if (paso.campo === 'vr_debitos' || paso.campo === 'vr_creditos') {
          // Solo propagar si el renglón destino no tiene su propio DIGITE
          if (!esDig(sig.vr_debitos) && !esDig(sig.vr_creditos)) {
            sig._valorHeredado = nuevas[i-1]._valorHeredado || l[paso.campo];
          }
        } else {
          sig[paso.campo] = nuevas[i-1][paso.campo];
        }
        nuevas[i] = sig;
      }
    }

    setLineas(nuevas);

    if (pasoActual < pasos.length - 1) {
      setPasoActual(pasoActual + 1);
      setValorWiz('');
      setErrWiz('');
    } else {
      // ── Al terminar el wizard: asignar valores a débito/crédito según tipo_mov ──
      const corregidas = nuevas.map(linea => {
        const l2 = { ...linea };
        // Si tiene _valorHeredado, asignarlo a la columna correcta
        if (l2._valorHeredado) {
          if (l2.tipo_mov === 'D') {
            l2.vr_debitos  = l2._valorHeredado;
            l2.vr_creditos = '';
          } else if (l2.tipo_mov === 'C') {
            l2.vr_creditos = l2._valorHeredado;
            l2.vr_debitos  = '';
          }
          delete l2._valorHeredado;
        }
        // Si por alguna razón el valor está en la columna equivocada, corregirlo
        if (l2.tipo_mov === 'D' && !l2.vr_debitos && l2.vr_creditos) {
          l2.vr_debitos  = l2.vr_creditos;
          l2.vr_creditos = '';
        } else if (l2.tipo_mov === 'C' && !l2.vr_creditos && l2.vr_debitos) {
          l2.vr_creditos = l2.vr_debitos;
          l2.vr_debitos  = '';
        }
        return l2;
      });
      setLineas(corregidas);
      setFase('formulario');
      toast.success('¡Todos los campos completados!');
    }
  };

  const retrocederWizard = () => {
    if (pasoActual > 0) { setPasoActual(pasoActual-1); setValorWiz(''); setErrWiz(''); }
  };

  // ── updateLinea ───────────────────────────────────────────────────────
  const updateLinea = (idx, campo, valor) => {
    setLineas(prev => {
      const arr = [...prev];
      arr[idx]  = { ...arr[idx], [campo]: valor };
      if (campo === 'cuenta') {
        const c = cuentas.find(c => c.codigo === valor);
        arr[idx].cuenta_desc = c ? c.descripcion : '';
      }
      if (campo === 'cedula') {
        const t = terceros.find(t => t.cedula === valor);
        arr[idx].tercero_nombre = t ? t.nombre_completo : '';
      }
      return arr;
    });
  };

  const updateLineaCampos = (idx, cambios) => {
    setLineas(prev => {
      const arr = [...prev];
      arr[idx]  = { ...arr[idx], ...cambios };
      return arr;
    });
  };

  const agregarLinea  = () => setLineas(p => [...p, {
    cuenta:'',cuenta_desc:'',observacion:'',cedula:'',tercero_nombre:'',
    centro_costo:'',vr_debitos:'',vr_creditos:'',
  }]);
  const eliminarLinea = i => { if(lineas.length>2) setLineas(p=>p.filter((_,j)=>j!==i)); };

  // ── Totales ───────────────────────────────────────────────────────────
  const totalDeb = lineas.reduce((s,l) => s+(parseFloat(l.vr_debitos) ||0),0);
  const totalCre = lineas.reduce((s,l) => s+(parseFloat(l.vr_creditos)||0),0);
  const cuadra   = Math.abs(totalDeb-totalCre)<0.01;

  const pendientes = lineas.filter(l=>
    [l.cuenta,l.observacion,l.cedula,l.centro_costo,l.vr_debitos,l.vr_creditos]
    .some(v=>esDig(v))).length;

  // ── Guardar ───────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!cabecera.cod_comprob) { toast.error('Seleccione un comprobante'); return; }
    if (!comprobantes.some(c => c.codigo === cabecera.cod_comprob)) {
      toast.error(`El comprobante "${cabecera.cod_comprob}" no está permitido para su rol.`);
      return;
    }
    for (const l of lineas) {
      if (l.cuenta && !esDig(l.cuenta) && !cuentas.some(c => c.codigo === l.cuenta)) {
        toast.error(`La cuenta "${l.cuenta}" no está permitida para su rol.`); return;
      }
      if (l.centro_costo && !esDig(l.centro_costo) && !centros.some(c => c.codigo === l.centro_costo)) {
        toast.error(`El centro de costo "${l.centro_costo}" no está permitido para su rol.`); return;
      }
    }
    if (pendientes>0)          { toast.error(`${pendientes} campo(s) sin completar`); return; }
    if (!cuadra)               { toast.error('El asiento no cuadra'); return; }
    const validas = lineas.filter(l=>
      l.cuenta && (parseFloat(l.vr_debitos)>0 || parseFloat(l.vr_creditos)>0));
    if (validas.length<2) { toast.error('Mínimo 2 líneas con valores'); return; }

    setSaving(true);
    try {
      const payload = {
        ...cabecera,
        lineas: validas.map((l,i) => ({
          item_comprob: i+1,
          cuenta:       l.cuenta,
          observacion:  !esDig(l.observacion)  ? l.observacion  : '',
          vr_debitos:   parseFloat(l.vr_debitos)  || 0,
          vr_creditos:  parseFloat(l.vr_creditos) || 0,
          cedula:       !esDig(l.cedula)       ? l.cedula        || null : null,
          centro_costo: !esDig(l.centro_costo) ? l.centro_costo  || null : null,
        })),
      };
      await createAsiento(payload);
      toast.success('Movimiento guardado');
      navigate(`/asientos?cod_comprob=${cabecera.cod_comprob}&plantilla=${plantillaActual?.cod_plantilla || ''}`);
    } catch(err) {
      const d = err.response?.data?.detail||err.response?.data?.lineas;
      toast.error(Array.isArray(d)?d[0]:(d||'Error al guardar'));
    } finally { setSaving(false); }
  };

  // ── Datos para el modal según tipo activo ────────────────────────────
  const datosBuscador = () => {
    const t = buscador.estado.tipo;
    if (t==='cuenta')  return cuentas;
    if (t==='tercero') return terceros;
    if (t==='cc')      return centros;
    return [];
  };

  const paso = pasos[pasoActual];

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <TopBar title="Asiento con Plantilla"/>
      <div className="p-4">

        {/* Header con indicador de fase */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <button className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate('/asientos')}>
            <i className="bi bi-arrow-left me-1"></i>Volver
          </button>
          <h4 className="mb-0 fw-bold flex-grow-1">Asiento — Plantilla Contable</h4>
          <div className="d-flex gap-2">
            {['seleccionar','wizard','formulario'].map((f,i) => (
              <span key={f} className={`badge rounded-pill ${fase===f?'bg-success':
                ['seleccionar','wizard','formulario'].indexOf(fase)>i?'bg-secondary':'bg-light text-muted'}`}
                style={{fontSize:11}}>
                {i+1}. {f==='seleccionar'?'Plantilla':f==='wizard'?'Completar':'Revisar'}
              </span>
            ))}
          </div>
        </div>

        {/* ── FASE 1: Seleccionar plantilla ─────────────────────────── */}
        {fase==='seleccionar' && (
          <div className="row g-3">
            {/* Columna izquierda: búsqueda + lista de plantillas */}
            <div className="col-md-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">
                  <i className="bi bi-layout-text-window me-2 text-primary"></i>
                  Seleccionar plantilla
                </div>
                <div className="card-body">
                  {/* Buscador */}
                  <div className="input-group mb-3">
                    <span className="input-group-text bg-white">
                      <i className="bi bi-search text-muted"></i>
                    </span>
                    <input className="form-control" autoFocus
                      placeholder="Buscar por código o nombre..."
                      value={busquedaPlantilla}
                      onChange={e => { setBusquedaPlantilla(e.target.value); setPlantillaId(''); }}
                    />
                    {busquedaPlantilla && (
                      <button className="btn btn-outline-secondary"
                        onClick={() => setBusquedaPlantilla('')}>
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </div>

                  {/* Lista */}
                  {plantillas.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="bi bi-inbox display-4 d-block mb-3"></i>
                      <p>No hay plantillas. <button className="btn btn-link p-0"
                        onClick={() => navigate('/plantillas')}>Crear una</button></p>
                    </div>
                  ) : (
                    <div className="list-group" ref={listaRef} style={{maxHeight:480, overflowY:'auto'}}>
                      {plantillas
                        .filter(p =>
                          !busquedaPlantilla ||
                          p.cod_plantilla?.toLowerCase().includes(busquedaPlantilla.toLowerCase()) ||
                          p.nombre?.toLowerCase().includes(busquedaPlantilla.toLowerCase()) ||
                          p.descripcion?.toLowerCase().includes(busquedaPlantilla.toLowerCase())
                        )
                        .map(p => (
                          <button key={p.id} type="button" data-pid={p.id}
                            className={`list-group-item list-group-item-action d-flex align-items-center gap-3
                              ${plantillaId===p.id?'active':''}`}
                            onClick={() => setPlantillaId(p.id)}
                            onDoubleClick={() => { setPlantillaId(p.id); aplicarPlantilla(p); }}>
                            {/* Código */}
                            <code className="fw-bold text-nowrap" style={{
                              minWidth:70,
                              color: plantillaId===p.id?'#fff':'inherit'
                            }}>
                              {p.cod_plantilla}
                            </code>
                            {/* Nombre y descripción */}
                            <div className="flex-grow-1 text-start">
                              <div className="fw-semibold">{p.nombre}</div>
                              {p.descripcion && (
                                <div className="small opacity-75">{p.descripcion}</div>
                              )}
                            </div>
                            {/* Badges */}
                            <div className="d-flex gap-1 flex-shrink-0">
                              <span className={`badge ${plantillaId===p.id?'bg-white text-success':'bg-light text-dark border'}`}>
                                {p.detalles?.length||0} líneas
                              </span>
                              {p.comprobante && (
                                <span className={`badge ${plantillaId===p.id?'bg-white text-primary':'bg-info text-dark'}`}>
                                  {p.comprobante}
                                </span>
                              )}
                            </div>
                            {plantillaId===p.id && (
                              <i className="bi bi-check-circle-fill flex-shrink-0"></i>
                            )}
                          </button>
                        ))}
                      {plantillas.filter(p =>
                        !busquedaPlantilla ||
                        p.cod_plantilla?.toLowerCase().includes(busquedaPlantilla.toLowerCase()) ||
                        p.nombre?.toLowerCase().includes(busquedaPlantilla.toLowerCase()) ||
                        p.descripcion?.toLowerCase().includes(busquedaPlantilla.toLowerCase())
                      ).length === 0 && (
                        <div className="text-center py-4 text-muted">
                          <i className="bi bi-search me-2"></i>
                          No se encontraron plantillas para <strong>"{busquedaPlantilla}"</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna derecha: controles + acciones */}
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white fw-semibold">
                  <i className="bi bi-sliders me-2 text-primary"></i>
                  Configuración
                </div>
                <div className="card-body">
                  {/* Caja user */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold mb-1">
                      <i className="bi bi-person-badge me-1 text-primary"></i>
                      Caja user
                    </label>
                    <input className="form-control form-control-sm font-monospace"
                      maxLength={10} value={cajaUser}
                      placeholder="Código de caja..."
                      onChange={e => setCajaUser(e.target.value)}/>
                    <div className="form-text">
                      Reemplaza <code>CajaUser</code> en la plantilla
                    </div>
                  </div>

                  {/* Sufijo comprobante */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold mb-1">
                      <i className="bi bi-type me-1 text-primary"></i>
                      Sufijo comprobante
                    </label>
                    <input className="form-control form-control-sm font-monospace"
                      maxLength={3} value={sufijoComprob} style={{ width: '20%' }}
                      placeholder="Ej: A, AB..."
                      onChange={e => setSufijoComprob(e.target.value.toUpperCase())}/>
                    <div className="form-text">
                      {sufijoComprob
                        ? <>Resultado: <code>{plantillaActual?.comprobante || '—'}{sufijoComprob}</code></>
                        : 'Se agrega al código del comprobante'}
                    </div>
                  </div>

                  <hr className="my-3" />

                  {/* Resumen selección + botones */}
                  {plantillaId ? (
                    <>
                      <div className="mb-3">
                        <div className="small text-muted mb-1">Seleccionada:</div>
                        <div className="fw-semibold">{plantillaActual?.nombre}</div>
                        <div className="d-flex gap-1 mt-1">
                          <span className="badge bg-light text-dark border">
                            {plantillaActual?.detalles?.length || 0} líneas
                          </span>
                          {plantillaActual?.comprobante && (
                            <span className="badge bg-info text-dark">
                              {plantillaActual?.comprobante}{sufijoComprob || ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm flex-grow-1"
                          onClick={() => setPlantillaId('')}>
                          <i className="bi bi-x me-1"></i>Limpiar
                        </button>
                        <button className="btn btn-success btn-sm flex-grow-1 px-3" onClick={() => aplicarPlantilla()} disabled={!canAdd}>
                          <i className="bi bi-play-fill me-1"></i>Usar
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-muted small py-3">
                      <i className="bi bi-arrow-left me-1"></i>
                      Seleccione una plantilla de la lista
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FASE 2: Wizard DIGITE ──────────────────────────────────── */}
        {fase==='wizard' && paso && (
          <div className="row justify-content-center">
            <div className="col-md-7">
              {/* Progreso */}
              <div className="mb-4">
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Completando campos requeridos</span>
                  <span>{pasoActual+1} de {pasos.length}</span>
                </div>
                <div className="progress" style={{height:8}}>
                  <div className="progress-bar bg-success"
                    style={{width:`${((pasoActual+1)/pasos.length)*100}%`}}></div>
                </div>
                <div className="d-flex gap-1 mt-2 flex-wrap">
                  {pasos.map((_,i)=>(
                    <span key={i} className={`badge rounded-pill ${
                      i<pasoActual?'bg-success':i===pasoActual?'bg-warning text-dark':'bg-light text-muted border'}`}
                      style={{fontSize:10}}>{i+1}</span>
                  ))}
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-header bg-light border-0">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle bg-warning d-flex align-items-center justify-content-center"
                      style={{width:40,height:40,flexShrink:0}}>
                      <i className="bi bi-pencil text-dark"></i>
                    </div>
                    <div>
                      <div className="fw-semibold">
                        {paso.label}
                        <span className="badge bg-secondary ms-2" style={{fontSize:11}}>
                          Línea {paso.lineaNum}/{paso.total}
                        </span>
                      </div>
                      {paso.descripcionOriginal&&paso.descripcionOriginal!==DIGIT&&(
                        <div className="text-muted small">{paso.descripcionOriginal}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-body py-4">
                  {/* Contexto de la línea */}
                  <div className="bg-light rounded p-3 mb-4 small">
                    <div className="fw-semibold mb-1 text-muted">Línea {paso.lineaNum}:</div>
                    <div className="d-flex gap-4 flex-wrap">
                      <div>
                        <span className="text-muted">Cuenta: </span>
                        <code>{lineas[paso.lineaIdx]?.cuenta||'—'}</code>
                        {lineas[paso.lineaIdx]?.cuenta_desc&&(
                          <span className="text-muted ms-1">— {lineas[paso.lineaIdx].cuenta_desc}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Input grande centrado */}
                  <div className="text-center mb-2">
                    <label className="form-label fw-semibold text-dark mb-3" style={{fontSize:16}}>
                      {paso.tipo==='monto'  ?'¿Cuánto es el valor?':
                       paso.tipo==='cuenta' ?'¿Cuál es el código de cuenta?':
                       paso.tipo==='tercero'?'¿Cuál es la cédula?':
                       paso.tipo==='cc'     ?'¿Cuál es el centro de costo?':
                       `Ingresa: ${paso.label}`}
                    </label>

                    {/* F3 también funciona en el wizard */}
                    <input
                      ref={inputRef}
                      type={paso.tipo==='monto'?'number':'text'}
                      min={paso.tipo==='monto'?'0':undefined}
                      step={paso.tipo==='monto'?'0.01':undefined}
                      className={`form-control form-control-lg text-center ${errWiz?'is-invalid':''}`}
                      style={{fontSize:22,fontWeight:500,maxWidth:320,margin:'0 auto'}}
                      placeholder={
                        paso.tipo==='monto'  ?'0.00':
                        paso.tipo==='cuenta' ?'Ej: 110505':
                        paso.tipo==='tercero'?'Ej: 1234567890':
                        paso.tipo==='cc'     ?'Ej: CC001':'...'}
                      value={valorWiz}
                      onChange={e=>{setValorWiz(e.target.value);setErrWiz('');}}
                      onKeyDown={e=>{
                        if (e.key==='Enter') avanzarWizard();
                        // F3 en el wizard abre el buscador correspondiente
                        if (e.key==='F3') {
                          e.preventDefault();
                          const tipo = paso.tipo==='cuenta'?'cuenta':
                                       paso.tipo==='tercero'?'tercero':
                                       paso.tipo==='cc'?'cc':null;
                          if (tipo) buscador.abrir(tipo, null, (item)=>{
                            const val = tipo==='cuenta'  ? item.codigo :
                                        tipo==='tercero' ? item.cedula  :
                                                           item.codigo;
                            setValorWiz(val);
                            setErrWiz('');
                          });
                        }
                      }}
                      list={
                        paso.tipo==='cuenta' ?'wiz-cuentas':
                        paso.tipo==='tercero'?'wiz-terceros':
                        paso.tipo==='cc'     ?'wiz-centros':undefined}
                    />
                    {paso.tipo==='cuenta'  &&<datalist id="wiz-cuentas">{cuentas.map(c=><option key={c.id} value={c.codigo}>{c.descripcion}</option>)}</datalist>}
                    {paso.tipo==='tercero' &&<datalist id="wiz-terceros">{terceros.map(t=><option key={t.id} value={t.cedula}>{t.nombre_completo}</option>)}</datalist>}
                    {paso.tipo==='cc'      &&<datalist id="wiz-centros">{centros.map(c=><option key={c.id} value={c.codigo}>{c.descripcion}</option>)}</datalist>}

                    {errWiz&&<div className="invalid-feedback d-block mt-2">{errWiz}</div>}
                    <div className="text-muted small mt-2">
                      <kbd>Enter</kbd> para avanzar &nbsp;|&nbsp; <kbd>F3</kbd> para buscar
                    </div>
                  </div>
                </div>

                <div className="card-footer bg-white d-flex justify-content-between">
                  <button className="btn btn-outline-secondary"
                    onClick={retrocederWizard} disabled={pasoActual===0}>
                    <i className="bi bi-arrow-left me-1"></i>Anterior
                  </button>
                  <span className="text-muted small">{pasoActual+1} / {pasos.length}</span>
                  <button className="btn btn-warning text-dark px-4 fw-semibold"
                    onClick={avanzarWizard}>
                    {pasoActual<pasos.length-1
                      ?<><i className="bi bi-arrow-right me-1"></i>Siguiente</>
                      :<><i className="bi bi-check2 me-1"></i>Finalizar</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FASE 3: Formulario de revisión ────────────────────────── */}
        {fase==='formulario' && (
          <>
            {pendientes>0&&(
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <span>
                  <strong>{pendientes}</strong> campo(s) pendientes.
                  <button className="btn btn-link btn-sm p-0 ms-2"
                    onClick={()=>{setPasoActual(0);setValorWiz('');setErrWiz('');setFase('wizard');}}>
                    Volver al wizard
                  </button>
                </span>
              </div>
            )}

            {/* Cabecera */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold d-flex justify-content-between">
                <span><i className="bi bi-file-text me-2 text-success"></i>Datos del comprobante</span>
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  Plantilla: {plantillaActual?.nombre}
                </span>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Comprobante *</label>
                    <select className="form-select" value={cabecera.cod_comprob}
                      onChange={e=>setCabecera({...cabecera,cod_comprob:e.target.value})}>
                      <option value="">Seleccionar...</option>
                      {comprobantes.map(c=>(
                        <option key={c.id} value={c.codigo}>{c.codigo} — {c.descripcion}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Nº Comprobante</label>
                    <input className="form-control form-control-sm font-monospace bg-light"
                      readOnly value={numComprob} placeholder="Auto"/>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Fecha *</label>
                    <input type="date" className="form-control" value={cabecera.fecha}
                      onChange={e=>setCabecera({...cabecera,fecha:e.target.value})}/>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Doc. Referencia</label>
                    <input className="form-control" value={cabecera.doc_ref}
                      onChange={e=>setCabecera({...cabecera,doc_ref:e.target.value})}/>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Soporte</label>
                    <input className="form-control" value={cabecera.doc_soporte}
                      onChange={e=>setCabecera({...cabecera,doc_soporte:e.target.value})}/>
                  </div>
                </div>
              </div>
            </div>

            {/* Líneas con F3 */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <span className="fw-semibold">
                  <i className="bi bi-list-ul me-2 text-success"></i>
                  Líneas del asiento
                  {pendientes>0&&<span className="badge bg-danger ms-2">{pendientes} pendientes</span>}
                </span>
                <div className="d-flex align-items-center gap-3">
                  <span className="text-muted small"><kbd>F3</kbd> en campos para buscar</span>
                  <button className="btn btn-outline-success btn-sm" onClick={agregarLinea} disabled={!canAdd}>
                    <i className="bi bi-plus-lg me-1"></i>Agregar línea
                  </button>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th style={{width:140}}>Cuenta <kbd style={{fontSize:9}}>F3</kbd></th>
                      <th style={{width:'8%'}}>Descripción</th>
                      <th style={{width:475}}>Observación</th>
                      <th style={{width:140}}>Cédula <kbd style={{fontSize:9}}>F3</kbd></th>
                      <th style={{width:260}}>Tercero</th>
                      <th style={{width:110}}>C.Costo <kbd style={{fontSize:9}}>F3</kbd></th>
                      <th style={{width:120}} className="text-end">Débito</th>
                      <th style={{width:120}} className="text-end">Crédito</th>
                      <th style={{width:36}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => {
                      const isDig = v => v&&v.toString().toUpperCase()===DIGIT;
                      return (
                        <tr key={i} className={isDig(l.vr_debitos)||isDig(l.vr_creditos)||isDig(l.cuenta)?'table-warning':''}>

                          {/* CUENTA + F3 */}
                          <td>
                            <div className="input-group input-group-sm">
                              <input
                                className={`form-control form-control-sm font-monospace ${isDig(l.cuenta)?'border-danger':''}`}
                                value={isDig(l.cuenta)?'':l.cuenta}
                                placeholder="Código / F3"
                                list={`f3-cuentas-${i}`}
                                onChange={e=>updateLinea(i,'cuenta',e.target.value)}
                                onKeyDown={e=>{
                                  if(e.key==='F3'){
                                    e.preventDefault();
                                    buscador.abrir('cuenta',i,(item,idx)=>updateLinea(idx,'cuenta',item.codigo));
                                  }
                                }}
                              />
                              <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                title="Buscar cuenta"
                                onClick={()=>buscador.abrir('cuenta',i,(item,idx)=>updateLinea(idx,'cuenta',item.codigo))}>
                                <i className="bi bi-search" style={{fontSize:10}}></i>
                              </button>
                              <datalist id={`f3-cuentas-${i}`}>
                                {cuentas.map(c=><option key={c.id} value={c.codigo}>{c.descripcion}</option>)}
                              </datalist>
                            </div>
                          </td>

                          {/* Descripción cuenta (readonly) */}
                          <td>
                            <input className="form-control form-control-sm bg-light" readOnly
                              value={l.cuenta_desc} placeholder="Nombre cuenta"/>
                          </td>

                          {/* Observación */}
                          <td>
                            <input
                              className={`form-control form-control-sm ${isDig(l.observacion)?'border-danger':''}`}
                              value={isDig(l.observacion)?'':l.observacion}
                              onChange={e=>updateLinea(i,'observacion',e.target.value)}/>
                          </td>

                          {/* CÉDULA + F3 */}
                          <td>
                            <div className="input-group input-group-sm">
                              <input
                                className={`form-control form-control-sm ${isDig(l.cedula)?'border-danger':''}`}
                                value={isDig(l.cedula)?'':l.cedula}
                                placeholder="Cédula / F3"
                                list={`f3-terceros-${i}`}
                                onChange={e=>updateLinea(i,'cedula',e.target.value)}
                                onKeyDown={e=>{
                                  if(e.key==='F3'){
                                    e.preventDefault();
                                    buscador.abrir('tercero',i,(item,idx)=>
                                      updateLineaCampos(idx,{
                                        cedula:         item.cedula,
                                        tercero_nombre: item.nombre_completo,
                                      })
                                    );
                                  }
                                }}
                              />
                              <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                title="Buscar tercero"
                                onClick={()=>buscador.abrir('tercero',i,(item,idx)=>
                                  updateLineaCampos(idx,{
                                    cedula:         item.cedula,
                                    tercero_nombre: item.nombre_completo,
                                  })
                                )}>
                                <i className="bi bi-search" style={{fontSize:10}}></i>
                              </button>
                              <datalist id={`f3-terceros-${i}`}>
                                {terceros.map(t=><option key={t.id} value={t.cedula}>{t.nombre_completo}</option>)}
                              </datalist>
                            </div>
                          </td>

                          {/* Nombre tercero (readonly) */}
                          <td>
                            <input className="form-control form-control-sm bg-light" readOnly
                              value={l.tercero_nombre} placeholder="Nombre"/>
                          </td>

                          {/* CENTRO COSTO + F3 */}
                          <td>
                            <div className="input-group input-group-sm">
                              <input
                                className={`form-control form-control-sm font-monospace ${isDig(l.centro_costo)?'border-danger':''}`}
                                value={isDig(l.centro_costo)?'':l.centro_costo}
                                placeholder="CC / F3"
                                list={`f3-cc-${i}`}
                                onChange={e=>updateLinea(i,'centro_costo',e.target.value)}
                                onKeyDown={e=>{
                                  if(e.key==='F3'){
                                    e.preventDefault();
                                    buscador.abrir('cc',i,(item,idx)=>updateLinea(idx,'centro_costo',item.codigo));
                                  }
                                }}
                              />
                              <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                title="Buscar centro de costo"
                                onClick={()=>buscador.abrir('cc',i,(item,idx)=>updateLinea(idx,'centro_costo',item.codigo))}>
                                <i className="bi bi-search" style={{fontSize:10}}></i>
                              </button>
                              <datalist id={`f3-cc-${i}`}>
                                {centros.map(c=><option key={c.id} value={c.codigo}>{c.descripcion}</option>)}
                              </datalist>
                            </div>
                          </td>

                          {/* Débito */}
                          <td>
                            <input type="number" min="0" step="0.01"
                              className={`form-control form-control-sm text-end ${isDig(l.vr_debitos)?'border-danger bg-danger bg-opacity-10':''}`}
                              value={isDig(l.vr_debitos)?'':l.vr_debitos}
                              onChange={e=>updateLinea(i,'vr_debitos',e.target.value)}/>
                          </td>

                          {/* Crédito */}
                          <td>
                            <input type="number" min="0" step="0.01"
                              className={`form-control form-control-sm text-end ${isDig(l.vr_creditos)?'border-danger bg-danger bg-opacity-10':''}`}
                              value={isDig(l.vr_creditos)?'':l.vr_creditos}
                              onChange={e=>updateLinea(i,'vr_creditos',e.target.value)}/>
                          </td>

                          <td>
                            <button className="btn btn-sm btn-outline-danger"
                              onClick={()=>eliminarLinea(i)} disabled={!canDel || lineas.length<=2}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className={cuadra?'table-success':'table-danger'}>
                    <tr>
                      <td colSpan={6} className="text-end fw-semibold">
                        {cuadra
                          ?<><i className="bi bi-check-circle-fill text-success me-1"></i>Cuadra</>
                          :<><i className="bi bi-x-circle-fill text-danger me-1"></i>
                             Diferencia: {formatMoney(Math.abs(totalDeb-totalCre))}</>}
                      </td>
                      <td className="text-end fw-bold">{formatMoney(totalDeb)}</td>
                      <td className="text-end fw-bold">{formatMoney(totalCre)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Botones */}
            <div className="d-flex gap-2 justify-content-between">
              <button className="btn btn-outline-secondary"
                onClick={()=>{setFase('seleccionar');setPlantillaId('');setLineas([]);}}>
                <i className="bi bi-arrow-counterclockwise me-1"></i>Cambiar plantilla
              </button>
              <div className="d-flex gap-2">
                <button className="btn btn-success"
                  disabled={!canAdd||saving||!cuadra||pendientes>0}
                  onClick={()=>guardar()}>
                  {saving
                    ?<><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                    :<><i className="bi bi-check2-all me-1"></i>Guardar movimiento</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal Buscador F3 ─────────────────────────────────────────── */}
      <ModalBuscador
        show={buscador.estado.show}
        tipo={buscador.estado.tipo}
        datos={datosBuscador()}
        onSelect={(item) => {
          const { onSelect, contexto } = buscador.estado;
          if (onSelect) onSelect(item, contexto);
          buscador.cerrar();
        }}
        onClose={buscador.cerrar}
      />
    </MainLayout>
  );
}