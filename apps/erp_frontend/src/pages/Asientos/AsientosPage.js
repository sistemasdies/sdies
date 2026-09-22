import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import MultiSelect from '../../components/common/MultiSelect';
import { getAsientos, getMovimiento, eliminarMovimiento, anularMovimiento, editarLineaMovimiento, editarLineasMovimientos } from '../../api/asientos';
import { getComprobantes } from '../../api/comprobantes';
import { getCuentas }     from '../../api/cuentas';
import { getCentrosCosto } from '../../api/centrosCosto';
import { getTerceros }    from '../../api/terceros';
import { formatMoney, formatDate } from '../../utils/formato';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePerm } from '../../hooks/usePerm';
import { useAuth } from '../../context/AuthContext';
import { useBuscador } from '../../hooks/useBuscador';
import ModalBuscador from '../../components/common/ModalBuscador';
import { usePreferencias } from '../../hooks/usePreferencias';
import toast from 'react-hot-toast';

const FILTROS_INICIALES = {
  fecha_desde:'', fecha_hasta:'', comprobante:[], cuenta:[], centro_costo:[],
  tercero:[], vr_debitos_min:'', vr_debitos_max:'', vr_creditos_min:'', vr_creditos_max:'',
  num_comprob_min:'', num_comprob_max:'', doc_ref:'', doc_soporte:'', observacion:'',
};

export default function AsientosPage() {
  const { hasControl } = useAuth();
  const buscador       = useBuscador();
  const { data: prefs, guardar: guardarPrefs, estaListo: prefsListo } = usePreferencias();
  const [searchParams] = useSearchParams();
  const initialComp = searchParams.get('cod_comprob');
  const initialPlantilla = searchParams.get('plantilla');
  const [asientos,  setAsientos]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [total,     setTotal]     = useState(0);
  const [pagina,    setPagina]    = useState(1);
  const [pageSize,  setPageSize]  = useState(25);
  const [filtros,   setFiltros]   = useState(() => ({
    ...FILTROS_INICIALES,
    comprobante: initialComp ? [initialComp] : [],
  }));
  const [opciones,  setOpciones]  = useState({ comprobantes:[], cuentas:[], centros:[], terceros:[] });
  const [orden,     setOrden]     = useState(() => initialComp
    ? { campo:'num_comprob', dir:'desc' }
    : { campo:'fecha', dir:'desc' });
  const [detalle,   setDetalle]   = useState({ show:false, lineas:[], loading:false, titulo:'', fecha:'' });
  const [editando,   setEditando]   = useState(false);
  const [edits,      setEdits]      = useState({});
  const [editSaving, setEditSaving] = useState(null);
  const [anular,    setAnular]    = useState({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false });
  const [eliminar,  setEliminar]  = useState({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false });
  const { canAdd, canDel, canAnular } = usePerm(window.location.pathname);
  const navigate = useNavigate();

  useEffect(() => {
    getComprobantes().then(r => setOpciones(o => ({ ...o, comprobantes:r.data.results || r.data }))).catch(()=>{});
    getCuentas({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, cuentas:r.data.results || r.data }))).catch(()=>{});
    getCentrosCosto().then(r => setOpciones(o => ({ ...o, centros:r.data.results || r.data }))).catch(()=>{});
    getTerceros({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, terceros:r.data.results || r.data }))).catch(()=>{});
  }, []);

  // Rehidratar filtros guardados (solo si no vengo navegando con filtro en la URL)
  useEffect(() => {
    if (!prefsListo || !prefs || initialComp) return;
    const guardados = prefs['asientos'];
    if (guardados?.filtros) {
      setFiltros(f => ({ ...f, ...guardados.filtros, comprobante: guardados.filtros.comprobante || f.comprobante }));
      if (guardados.orden) setOrden(guardados.orden);
    }
  }, [prefsListo]);

  // Persistir filtros en preferencias cada vez que cambian (con debounce sencillo)
  useEffect(() => {
    if (!guardarPrefs) return;
    const prefsAtrasadas = setTimeout(() => {
      guardarPrefs({ 'asientos': { ...(prefs?.['asientos'] || {}), filtros, orden } });
    }, 600);
    return () => clearTimeout(prefsAtrasadas);
  }, [filtros, orden]);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = {
      page: pagina, page_size: pageSize,
      fecha_desde: filtros.fecha_desde || undefined,
      fecha_hasta: filtros.fecha_hasta || undefined,
      comprobante: filtros.comprobante.length ? filtros.comprobante.join(',') : undefined,
      cuenta:      filtros.cuenta.length      ? filtros.cuenta.join(',')      : undefined,
      centro_costo:filtros.centro_costo.length? filtros.centro_costo.join(',') : undefined,
      cedula:      filtros.tercero.length     ? filtros.tercero.join(',')     : undefined,
      vr_debitos_min:  filtros.vr_debitos_min  || undefined,
      vr_debitos_max:  filtros.vr_debitos_max  || undefined,
      vr_creditos_min: filtros.vr_creditos_min || undefined,
      vr_creditos_max: filtros.vr_creditos_max || undefined,
      num_comprob_min: filtros.num_comprob_min || undefined,
      num_comprob_max: filtros.num_comprob_max || undefined,
      doc_ref:      filtros.doc_ref      || undefined,
      doc_soporte:  filtros.doc_soporte  || undefined,
      observacion:  filtros.observacion  || undefined,
      ...(orden.campo !== 'diferencia' ? { orden: (orden.dir === 'desc' ? '-' : '') + orden.campo } : {}),
    };
    Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
    getAsientos(params).then(r => {
      let rows = r.data.results || r.data;
      if (orden.campo === 'diferencia') {
        rows = [...rows].sort((a, b) => {
          const da = Math.abs((parseFloat(a.total_debitos) || 0) - (parseFloat(a.total_creditos) || 0));
          const db = Math.abs((parseFloat(b.total_debitos) || 0) - (parseFloat(b.total_creditos) || 0));
          return orden.dir === 'asc' ? da - db : db - da;
        });
      }
      setAsientos(rows);
      setTotal(r.data.count || 0);
    }).catch(()=>{}).finally(() => setLoading(false));
  }, [pagina, filtros, orden, pageSize]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirEliminar = (a) => setEliminar({ show:true, cod_comprob:a.cod_comprob, num_comprob:a.num_comprob, ok:'', loading:false });

  const handleConfirmaEliminar = async () => {
    if (eliminar.ok.trim().toUpperCase() !== 'OK') {
      toast.error('Debe escribir "Ok" para confirmar');
      return;
    }
    setEliminar(e => ({ ...e, loading: true }));
    try {
      await eliminarMovimiento(eliminar.cod_comprob, eliminar.num_comprob);
      toast.success('Movimiento eliminado');
      setEliminar({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false });
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
      setEliminar(e => ({ ...e, loading: false }));
    }
  };

  const handleAnular = async () => {
    if (anular.ok.trim().toUpperCase() !== 'OK') {
      toast.error('Debe escribir "Ok" para confirmar');
      return;
    }
    setAnular(a => ({ ...a, loading: true }));
    try {
      await anularMovimiento(anular.cod_comprob, anular.num_comprob);
      toast.success('Movimiento anulado');
      setAnular({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false });
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al anular');
      setAnular(a => ({ ...a, loading: false }));
    }
  };

  const handleVer = async (a) => {
    setDetalle({ show:true, lineas:[], loading:true, titulo:a.referencia, fecha:a.fecha });
    try {
      const r = await getMovimiento({ cod_comprob: a.cod_comprob, num_comprob: a.num_comprob });
      setDetalle(d => ({ ...d, lineas:r.data, loading:false, fecha:r.data[0]?.fecha || d.fecha }));
      setEditando(false);
      setEdits({});
    } catch (err) {
      toast.error('Error al cargar el detalle');
      setDetalle(d => ({ ...d, loading:false }));
    }
  };

  const nuevoEdits = (lineas) => {
    const m = {};
    lineas.forEach(l => {
      m[l.id] = {
        fecha:         l.fecha,
        cuenta:        l.cuenta || '',
        doc_ref:       l.doc_ref || '',
        observacion:   l.observacion || '',
        cedula:        l.cedula || '',
        centro_costo:  l.centro_costo || '',
        doc_soporte:   l.doc_soporte || '',
        vr_debitos:    l.vr_debitos ?? '',
        vr_creditos:   l.vr_creditos ?? '',
      };
    });
    return m;
  };

  const abrirEdicion = () => { setEdits(nuevoEdits(detalle.lineas)); setEditando(true); };

  const setEdit = (id, campo, valor) =>
    setEdits(m => ({ ...m, [id]: { ...m[id], [campo]: valor } }));

  const setFechaMov = (valor) => setEdits(m => {
    const n = {};
    Object.keys(m).forEach(k => n[k] = { ...m[k], fecha: valor });
    return n;
  });

  const moverRenglon = (id, delta) => {
    const idx = detalle.lineas.findIndex(l => l.id === id);
    const destino = idx + delta;
    if (idx < 0 || destino < 0 || destino >= detalle.lineas.length) return;
    const idA = detalle.lineas[idx].id;
    const idB = detalle.lineas[destino].id;
    setEdits(m => {
      const a = m[idA];
      const b = m[idB];
      if (!a || !b) return m;
      const n = { ...m };
      n[idA] = b;
      n[idB] = a;
      return n;
    });
  };

  const descCuenta = (cod) => opciones.cuentas.find(c => c.codigo === cod)?.descripcion || '';
  const nombreTerc = (ced) => opciones.terceros.find(t => t.cedula === ced)?.nombre_completo || '';
  const descCentro = (cod) => opciones.centros.find(c => c.codigo === cod)?.descripcion || '';

  const totalDeb = editando
    ? Object.values(edits).reduce((s, e) => s + (parseFloat(e.vr_debitos)  || 0), 0)
    : detalle.lineas.reduce((s, l) => s + (parseFloat(l.vr_debitos)  || 0), 0);
  const totalCre = editando
    ? Object.values(edits).reduce((s, e) => s + (parseFloat(e.vr_creditos) || 0), 0)
    : detalle.lineas.reduce((s, l) => s + (parseFloat(l.vr_creditos) || 0), 0);
  const diferencia = totalDeb - totalCre;

  const f3Cuenta = (e, id) => buscador.onKeyDown(e, 'cuenta', id, (item, ctx) => {
    setEdit(ctx, 'cuenta', item.codigo);
  });
  const f3Tercero = (e, id) => buscador.onKeyDown(e, 'tercero', id, (item, ctx) => {
    setEdit(ctx, 'cedula', item.cedula);
  });
  const f3CC = (e, id) => buscador.onKeyDown(e, 'cc', id, (item, ctx) => {
    setEdit(ctx, 'centro_costo', item.codigo);
  });

  const datosBuscador = () => {
    const t = buscador.estado.tipo;
    if (t === 'cuenta')  return opciones.cuentas;
    if (t === 'tercero') return opciones.terceros;
    if (t === 'cc')      return opciones.centros;
    return [];
  };

  const guardarLinea = async (l) => {
    const e = edits[l.id];
    if (!e) return;
    setEditSaving(l.id);
    try {
      await editarLineaMovimiento({
        cod_comprob:  l.cod_comprob,
        num_comprob:  l.num_comprob,
        item_comprob: l.item_comprob,
        fecha:        e.fecha,
        cuenta:       e.cuenta,
        doc_ref:      e.doc_ref,
        observacion:  e.observacion,
        cedula:       e.cedula || null,
        centro_costo: e.centro_costo || null,
        doc_soporte:  e.doc_soporte,
        vr_debitos:   e.vr_debitos === '' ? 0 : e.vr_debitos,
        vr_creditos:  e.vr_creditos === '' ? 0 : e.vr_creditos,
      });
      toast.success('Línea actualizada');
      const r = await getMovimiento({ cod_comprob: l.cod_comprob, num_comprob: l.num_comprob });
      setDetalle(d => ({ ...d, lineas: r.data, fecha: r.data[0]?.fecha || d.fecha }));
      setEdits(nuevoEdits(r.data));
      cargar();
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg || 'Error al actualizar la línea'));
    } finally { setEditSaving(null); }
  };

  const guardarFecha = async () => {
    const l0 = detalle.lineas[0];
    const e = l0 && edits[l0.id];
    if (!l0 || !e) return;
    setEditSaving('fecha');
    try {
      await editarLineaMovimiento({
        cod_comprob:  l0.cod_comprob,
        num_comprob:  l0.num_comprob,
        item_comprob: l0.item_comprob,
        fecha:        e.fecha,
      });
      toast.success('Fecha actualizada');
      const r = await getMovimiento({ cod_comprob: l0.cod_comprob, num_comprob: l0.num_comprob });
      setDetalle(d => ({ ...d, lineas: r.data, fecha: r.data[0]?.fecha || d.fecha }));
      setEdits(nuevoEdits(r.data));
      cargar();
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg || 'Error al actualizar la fecha'));
    } finally { setEditSaving(null); }
  };

  const guardarTodos = async () => {
    const lineas = detalle.lineas;
    if (!lineas || lineas.length === 0) return;
    const l0 = lineas[0];
    const lineasPayload = lineas
      .map(l => {
        const e = edits[l.id];
        if (!e) return null;
        return {
          cod_comprob:  l.cod_comprob,
          num_comprob:  l.num_comprob,
          item_comprob: l.item_comprob,
          cuenta:       e.cuenta,
          doc_ref:      e.doc_ref,
          observacion:  e.observacion,
          cedula:       e.cedula || null,
          centro_costo: e.centro_costo || null,
          doc_soporte:  e.doc_soporte,
          vr_debitos:   e.vr_debitos === '' ? 0 : e.vr_debitos,
          vr_creditos:  e.vr_creditos === '' ? 0 : e.vr_creditos,
        };
      })
      .filter(Boolean);
    const l0e = l0 && edits[l0.id];
    setEditSaving('todos');
    try {
      const payload = { lineas: lineasPayload };
      if (l0e && l0e.fecha) payload.fecha = l0e.fecha;
      await editarLineasMovimientos(payload);
      toast.success(`Guardadas ${lineasPayload.length} línea(s)`);
      const r = await getMovimiento({ cod_comprob: l0.cod_comprob, num_comprob: l0.num_comprob });
      setDetalle(d => ({ ...d, lineas: r.data, fecha: r.data[0]?.fecha || d.fecha }));
      setEdits(nuevoEdits(r.data));
      cargar();
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(Array.isArray(msg) ? msg.join(' · ') : (msg || 'Error al guardar los renglones'));
    } finally { setEditSaving(null); }
  };

  const totalPaginas = Math.ceil(total / pageSize);

  const handleOrden = (campo) => {
    setOrden(o => o.campo === campo
      ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' }
      : { campo, dir: 'asc' });
    setPagina(1);
  };

  const Encabezado = ({ campo, children, className }) => {
    const activo = orden.campo === campo;
    return (
      <th className={`${className || ''} ${activo ? 'text-primary' : ''}`}
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        onClick={() => handleOrden(campo)}>
        {children}
        {activo && <i className={`bi bi-arrow-${orden.dir === 'asc' ? 'up' : 'down'} ms-1`}></i>}
        {!activo && <i className="bi bi-arrow-down-up ms-1 opacity-25"></i>}
      </th>
    );
  };

  return (
    <MainLayout>
      <TopBar title="Asientos Contables" />
      <div className="p-4">
        <PageHeader title="Movimientos Contables"
          subtitle={`${total} movimiento(s) encontrado(s)`}>
          <button className="btn btn-success" disabled={!canAdd}
            onClick={() => navigate(initialPlantilla
              ? `/asientos/plantilla?plantilla=${initialPlantilla}`
              : '/asientos/nuevo')}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo asiento
          </button>
        </PageHeader>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            {/* Fila 1: Fechas, Comprobante, Nº Comp, Débitos/Créditos, Doc Ref/Soporte */}
            <div className="row g-2 align-items-end mb-2">
              <div className="col-md-3 col-lg-1">
                <label className="form-label small mb-1">Fecha desde</label>
                <input type="date" className="form-control form-control-sm"
                  value={filtros.fecha_desde}
                  onChange={e => setFiltros({...filtros, fecha_desde: e.target.value})} />
              </div>
              <div className="col-md-3 col-lg-1">
                <label className="form-label small mb-1">Fecha hasta</label>
                <input type="date" className="form-control form-control-sm"
                  value={filtros.fecha_hasta}
                  onChange={e => setFiltros({...filtros, fecha_hasta: e.target.value})} />
              </div>
              <div className="col-md-6 col-lg-2">
                <label className="form-label small mb-1">Comprobante</label>
                <MultiSelect options={opciones.comprobantes} value={filtros.comprobante}
                  getKey={c => c.codigo} getLabel={c => c.codigo}
                  onChange={v => setFiltros(f => ({ ...f, comprobante: v }))} />
              </div>
              <div className="col-md-3 col-lg-1">
                <label className="form-label small mb-1">Nº desde</label>
                <input type="number" className="form-control form-control-sm"
                  value={filtros.num_comprob_min}
                  onChange={e => setFiltros({...filtros, num_comprob_min: e.target.value})} />
              </div>
              <div className="col-md-3 col-lg-1">
                <label className="form-label small mb-1">Nº hasta</label>
                <input type="number" className="form-control form-control-sm"
                  value={filtros.num_comprob_max}
                  onChange={e => setFiltros({...filtros, num_comprob_max: e.target.value})} />
              </div>
              <div className="col-md-3 col-lg-1">
                <label className="form-label small mb-1">Débito desde</label>
                <input type="number" step="any" className="form-control form-control-sm"
                  value={filtros.vr_debitos_min}
                  onChange={e => setFiltros({...filtros, vr_debitos_min: e.target.value})} />
              </div>
              <div className="col-md-3 col-lg-1">
                <label className="form-label small mb-1">Débito hasta</label>
                <input type="number" step="any" className="form-control form-control-sm"
                  value={filtros.vr_debitos_max}
                  onChange={e => setFiltros({...filtros, vr_debitos_max: e.target.value})} />
              </div>
              <div className="col-md-3 col-lg-1">
                <label className="form-label small mb-1">Crédito desde</label>
                <input type="number" step="any" className="form-control form-control-sm"
                  value={filtros.vr_creditos_min}
                  onChange={e => setFiltros({...filtros, vr_creditos_min: e.target.value})} />
              </div>
              <div className="col-md-3 col-lg-1">
                <label className="form-label small mb-1">Crédito hasta</label>
                <input type="number" step="any" className="form-control form-control-sm"
                  value={filtros.vr_creditos_max}
                  onChange={e => setFiltros({...filtros, vr_creditos_max: e.target.value})} />
              </div>
              <div className="col-md-6 col-lg-1">
                <label className="form-label small mb-1">Doc. Refe.</label>
                <input className="form-control form-control-sm"
                  placeholder="Buscar..."
                  value={filtros.doc_ref}
                  onChange={e => setFiltros({...filtros, doc_ref: e.target.value})} />
              </div>
              <div className="col-md-6 col-lg-1">
                <label className="form-label small mb-1">Doc. Soporte</label>
                <input className="form-control form-control-sm"
                  placeholder="Buscar..."
                  value={filtros.doc_soporte}
                  onChange={e => setFiltros({...filtros, doc_soporte: e.target.value})} />
              </div>
            </div>

            {/* Fila 2: Centro costo, Cuenta, Tercero, Observación, Acciones */}
            <div className="row g-2 align-items-end">
              <div className="col-md-6 col-lg-2">
                <label className="form-label small mb-1">Centro de costo</label>
                <MultiSelect options={opciones.centros} value={filtros.centro_costo}
                  getKey={cc => cc.codigo} getLabel={cc => `${cc.codigo} — ${cc.descripcion}`}
                  onChange={v => setFiltros(f => ({ ...f, centro_costo: v }))} />
              </div>
              <div className="col-md-6 col-lg-2">
                <label className="form-label small mb-1">Cuenta</label>
                <MultiSelect options={opciones.cuentas} value={filtros.cuenta}
                  getKey={c => c.codigo} getLabel={c => `${c.codigo} — ${c.descripcion}`}
                  onChange={v => setFiltros(f => ({ ...f, cuenta: v }))} />
              </div>
              <div className="col-md-6 col-lg-2">
                <label className="form-label small mb-1">Tercero</label>
                <MultiSelect options={opciones.terceros} value={filtros.tercero}
                  getKey={t => t.cedula} getLabel={t => `${t.cedula} — ${t.nombre_completo}`}
                  onChange={v => setFiltros(f => ({ ...f, tercero: v }))} />
              </div>
              <div className="col-md-6 col-lg-3">
                <label className="form-label small mb-1">Observación</label>
                <input className="form-control form-control-sm"
                  placeholder="Buscar en observación..."
                  value={filtros.observacion}
                  onChange={e => setFiltros({...filtros, observacion: e.target.value})} />
              </div>
              <div className="col-md-12 col-lg-3">
                <div className="d-flex align-items-end gap-2">
                  <div style={{minWidth:100}}>
                    <label className="form-label small mb-1">Líneas</label>
                    <input type="number" min={1} className="form-control form-control-sm text-center"
                      value={pageSize}
                      onChange={e => { const v = parseInt(e.target.value) || 1; setPageSize(v); }} />
                  </div>
                  <button className="btn btn-primary btn-sm flex-grow-1"
                    onClick={() => { setPagina(1); cargar(); }}>
                    <i className="bi bi-search me-1"></i>Buscar
                  </button>
                  <button className="btn btn-outline-secondary btn-sm"
                    title="Limpiar filtros"
                    onClick={() => { setFiltros(FILTROS_INICIALES); setPageSize(25); setPagina(1); }}>
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          {loading ? <div className="p-4"><Spinner /></div> : (
            <>
              <div className="table-responsive" style={{maxHeight:'65vh', overflowY:'auto'}}>
                <table className="table table-hover table-sm mb-0">
                  <thead className="table-dark" style={{position:'sticky', top:0, zIndex:1}}>
                    <tr>
                      <Encabezado campo="cod_comprob">CodComprob</Encabezado>
                      <Encabezado campo="num_comprob">NumComprob</Encabezado>
                      <Encabezado campo="fecha">Fecha</Encabezado>
                      <Encabezado campo="num_lineas" className="text-center">Nº líneas</Encabezado>
                      <Encabezado campo="total_debitos" className="text-end">Débitos</Encabezado>
                      <Encabezado campo="total_creditos" className="text-end">Créditos</Encabezado>
                      <Encabezado campo="diferencia" className="text-end">Diferencia</Encabezado>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asientos.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-muted py-4">
                        Sin movimientos para los filtros seleccionados
                      </td></tr>
                    )}
                    {asientos.map(a => {
                      const dif = Math.abs((parseFloat(a.total_debitos)||0) - (parseFloat(a.total_creditos)||0));
                      const descuadrado = dif >= 0.01;
                      return (
                      <tr key={`${a.cod_comprob}-${a.num_comprob}`}
                          className={descuadrado ? 'table-danger fw-bold' : ''}>
                        <td><code className="small">{a.cod_comprob}</code></td>
                        <td className="small">{a.num_comprob}</td>
                        <td className="small">{formatDate(a.fecha)}</td>
                        <td className="text-center small">{a.num_lineas}</td>
                        <td className="text-end small">{formatMoney(a.total_debitos)}</td>
                        <td className="text-end small">{formatMoney(a.total_creditos)}</td>
                        <td className="text-end small">
                          {descuadrado ? (
                            <span className="text-danger fw-bold">
                              <i className="bi bi-exclamation-triangle-fill me-1"></i>
                              {formatMoney(dif)}
                            </span>
                          ) : (
                            <span className="text-success">
                              <i className="bi bi-check-circle-fill me-1"></i>
                              {formatMoney(0)}
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary"
                              onClick={() => handleVer(a)} title="Ver detalle">
                              <i className="bi bi-eye"></i>
                            </button>
                            <button className="btn btn-outline-danger"
                              disabled={!canDel}
                              onClick={() => abrirEliminar(a)} title="Eliminar">
                              <i className="bi bi-trash"></i>
                            </button>
                            <button className="btn btn-outline-warning"
                              disabled={!canAnular}
                              onClick={() => setAnular({ show:true, cod_comprob:a.cod_comprob, num_comprob:a.num_comprob, ok:'', loading:false })}
                              title="Anular">
                              <i className="bi bi-slash-circle"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="card-footer d-flex justify-content-between align-items-center">
                  <span className="small text-muted">Página {pagina} de {totalPaginas}</span>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-secondary"
                      disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <button className="btn btn-outline-secondary"
                      disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      {detalle.show && (
        <div className="modal fade show d-block" tabIndex="-1" style={{backgroundColor:'rgba(0,0,0,.5)'}}
          onClick={() => { setDetalle(d => ({ ...d, show:false })); setEditando(false); setEdits({}); }}>
          <div className="modal-dialog modal-fullscreen modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header" style={{justifyContent:'flex-start'}}>
                <h6 className="modal-title">
                  <i className="bi bi-journal-text me-2 text-success"></i>
                  Movimiento {detalle.titulo}
                  {!editando && detalle.fecha && (
                    <span className="text-muted ms-2 small">· Fecha del documento: {formatDate(detalle.fecha)}</span>
                  )}
                  {editando && (
                    <span className="d-inline-flex align-items-center ms-2 gap-2">
                      <span className="text-muted small">· Fecha del documento:</span>
                      <input type="date" className="form-control form-control-sm" style={{maxWidth:155}}
                        value={edits[detalle.lineas[0]?.id]?.fecha || ''}
                        onChange={ev => setFechaMov(ev.target.value)} />
                      {hasControl('guardar_fecha') && (
                        <button className="btn btn-success btn-sm" title="Guardar fecha"
                          disabled={editSaving !== null}
                          onClick={guardarFecha}>
                          {editSaving === 'fecha'
                            ? <span className="spinner-border spinner-border-sm"></span>
                            : <i className="bi bi-check-lg"></i>}
                        </button>
                      )}
                    </span>
                  )}
                </h6>
                {detalle.lineas.length > 0 && (
                  <div className="d-flex align-items-center gap-3 ms-auto me-3" style={{fontSize:12}}>
                    <span className="fw-semibold">
                      Débitos: <span className="text-success">{formatMoney(totalDeb)}</span>
                    </span>
                    <span className="fw-semibold">
                      Créditos: <span className="text-primary">{formatMoney(totalCre)}</span>
                    </span>
                    <span className={`fw-bold ${Math.abs(diferencia) < 0.01 ? 'text-success' : 'text-danger'}`}>
                      {Math.abs(diferencia) < 0.01
                        ? <><i className="bi bi-check-circle-fill me-1"></i>0.00</>
                        : <>Dif: {formatMoney(diferencia)}</>}
                    </span>
                  </div>
                )}
                {hasControl('guardar_todo') && editando && (
                  <button className="btn btn-success btn-sm" style={{marginLeft:20}}
                    title="Guardar todos los renglones"
                    disabled={editSaving !== null}
                    onClick={guardarTodos}>
                    {editSaving === 'todos'
                      ? <span className="spinner-border spinner-border-sm"></span>
                      : <><i className="bi bi-check2-all me-1"></i>Guardar todos</>}
                  </button>
                )}
                {hasControl('editar_movimiento') && (
                  <button className="btn btn-sm btn-primary" style={{marginLeft:50}}
                    onClick={() => editando ? setEditando(false) : abrirEdicion()}>
                    {editando
                      ? <><i className="bi bi-check-lg me-1"></i>Terminar edición</>
                      : <><i className="bi bi-pencil me-1"></i>Editar</>}
                  </button>
                )}
                <button type="button" className="btn-close ms-auto"
                  onClick={() => { setDetalle(d => ({ ...d, show:false })); setEditando(false); setEdits({}); }}></button>
              </div>
              <div className="modal-body d-flex flex-column p-0">
                {detalle.loading ? <div className="p-4"><Spinner /></div> : (
                  <div className="table-responsive flex-grow-1">
                    {editando && (
                      <div className="d-flex align-items-center gap-2 px-3 py-2 bg-light border-bottom">
                        <i className="bi bi-info-circle text-primary"></i>
                        <span className="small">
                          Edite cualquier dato de cada línea. Los campos clave
                          <code> CodComprob / NumComprob / ItemComprob </code> no son editables.
                          La <strong>fecha</strong> se aplica a todo el movimiento.
                        </span>
                      </div>
                    )}
                    <table className="table table-sm table-striped mb-0">
                      <thead className="table-light" style={{position:'sticky', top:0, zIndex:1}}>
                        <tr>
                          <th className="text-center" style={{width:60}}>Item</th>
                          <th>Cuenta</th>
                          <th style={{width:200}}>Descripción</th>
                          <th>Cédula</th>
                          <th style={{width:200}}>Tercero</th>
                          <th style={{width:200}}>Observación</th>
                          <th>Doc ref.</th>
                          <th>Doc soporte</th>
                          <th>C. costo</th>
                          <th className="text-end">Débito</th>
                          <th className="text-end">Crédito</th>
                          {editando && <th className="text-center">Acción</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.lineas.length === 0 && (
                          <tr><td colSpan={editando ? 12 : 11} className="text-center text-muted py-3">Sin líneas</td></tr>
                        )}
                        {detalle.lineas.map(l => {
                          const e = edits[l.id];
                          const ed = editando && e;
                          return (
                            <tr key={l.id}>
                              <td className="text-center small">{l.item_comprob}</td>
                              <td>
                                {ed ? (
                                  <div className="input-group input-group-sm">
                                    <input className="form-control form-control-sm font-monospace"
                                      value={e.cuenta} placeholder="Código"
                                      onChange={ev => setEdit(l.id, 'cuenta', ev.target.value)}
                                      onKeyDown={ev => f3Cuenta(ev, l.id)}
                                      title="F3 para buscar" />
                                    <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                      onClick={() => buscador.abrir('cuenta', l.id, (item, ctx) =>
                                        setEdit(ctx, 'cuenta', item.codigo))}>
                                      <i className="bi bi-search" style={{fontSize:10}}></i>
                                    </button>
                                  </div>
                                ) : <code>{l.cuenta}</code>}
                              </td>
                              <td className="small">
                                {ed ? descCuenta(e.cuenta) : l.cuenta_descripcion}
                              </td>
                              <td>
                                {ed ? (
                                  <div className="input-group input-group-sm">
                                    <input className="form-control form-control-sm"
                                      value={e.cedula} placeholder="Cédula"
                                      onChange={ev => setEdit(l.id, 'cedula', ev.target.value)}
                                      onKeyDown={ev => f3Tercero(ev, l.id)}
                                      title="F3 para buscar" />
                                    <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                      onClick={() => buscador.abrir('tercero', l.id, (item, ctx) =>
                                        setEdit(ctx, 'cedula', item.cedula))}>
                                      <i className="bi bi-search" style={{fontSize:10}}></i>
                                    </button>
                                  </div>
                                ) : (l.cedula || '')}
                              </td>
                              <td className="small">
                                {ed ? nombreTerc(e.cedula) : (l.tercero_nombre || '')}
                              </td>
                              <td>
                                {ed ? (
                                  <input className="form-control form-control-sm" maxLength={200}
                                    value={e.observacion}
                                    onChange={ev => setEdit(l.id, 'observacion', ev.target.value)} />
                                ) : (l.observacion || '')}
                              </td>
                              <td>
                                {ed ? (
                                  <input className="form-control form-control-sm" maxLength={14}
                                    value={e.doc_ref}
                                    onChange={ev => setEdit(l.id, 'doc_ref', ev.target.value)} />
                                ) : (l.doc_ref || '')}
                              </td>
                              <td>
                                {ed ? (
                                  <input className="form-control form-control-sm" maxLength={15}
                                    value={e.doc_soporte}
                                    onChange={ev => setEdit(l.id, 'doc_soporte', ev.target.value)} />
                                ) : (l.doc_soporte || '')}
                              </td>
                              <td>
                                {ed ? (
                                  <div className="input-group input-group-sm">
                                    <input className="form-control form-control-sm font-monospace"
                                      value={e.centro_costo} placeholder="CC"
                                      onChange={ev => setEdit(l.id, 'centro_costo', ev.target.value)}
                                      onKeyDown={ev => f3CC(ev, l.id)}
                                      title="F3 para buscar" />
                                    <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                      onClick={() => buscador.abrir('cc', l.id, (item, ctx) =>
                                        setEdit(ctx, 'centro_costo', item.codigo))}>
                                      <i className="bi bi-search" style={{fontSize:10}}></i>
                                    </button>
                                  </div>
                                ) : (l.centro_costo || '')}
                              </td>
                              <td className="text-end">
                                {ed ? (
                                  <input type="number" step="any" min="0" className="form-control form-control-sm text-end"
                                    value={e.vr_debitos}
                                    onChange={ev => setEdit(l.id, 'vr_debitos', ev.target.value)} />
                                ) : (l.vr_debitos ? formatMoney(l.vr_debitos) : '')}
                              </td>
                              <td className="text-end">
                                {ed ? (
                                  <input type="number" step="any" min="0" className="form-control form-control-sm text-end"
                                    value={e.vr_creditos}
                                    onChange={ev => setEdit(l.id, 'vr_creditos', ev.target.value)} />
                                ) : (l.vr_creditos ? formatMoney(l.vr_creditos) : '')}
                              </td>
                              {editando && hasControl('guardar_renglon') && (
                                <td className="text-center">
                                  <div className="d-flex justify-content-center gap-1">
                                    <button className="btn btn-primary btn-sm"
                                      title="Guardar renglón"
                                      disabled={editSaving === l.id}
                                      onClick={() => guardarLinea(l)}>
                                      {editSaving === l.id
                                        ? <span className="spinner-border spinner-border-sm"></span>
                                        : <i className="bi bi-check-lg"></i>}
                                    </button>
                                    <div className="btn-group btn-group-vertical btn-group-sm">
                                      <button className="btn btn-outline-secondary px-1" title="Subir renglón (intercambia datos con el superior)"
                                        disabled={l === detalle.lineas[0] || editSaving !== null}
                                        onClick={() => moverRenglon(l.id, -1)}>
                                        <i className="bi bi-chevron-up"></i>
                                      </button>
                                      <button className="btn btn-outline-secondary px-1" title="Bajar renglón (intercambia datos con el inferior)"
                                        disabled={l === detalle.lineas[detalle.lineas.length - 1] || editSaving !== null}
                                        onClick={() => moverRenglon(l.id, 1)}>
                                        <i className="bi bi-chevron-down"></i>
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setDetalle(d => ({ ...d, show:false })); setEditando(false); setEdits({}); }}>
                  Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Anular */}
      {anular.show && (
        <div className="modal fade show d-block" tabIndex="-1" style={{backgroundColor:'rgba(0,0,0,.5)'}}
          onClick={() => !anular.loading && setAnular({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false })}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h6 className="modal-title fw-bold">
                  <i className="bi bi-slash-circle me-2"></i>Anular movimiento
                </h6>
                <button type="button" className="btn-close" disabled={anular.loading}
                  onClick={() => setAnular({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false })}></button>
              </div>
              <div className="modal-body">
                <p className="mb-3">
                  Se anulará el movimiento <strong>{anular.cod_comprob}-{anular.num_comprob}</strong>.
                  Todos los valores serán puestos en cero y la observación se marcará como "ANULADO".
                </p>
                <p className="text-danger fw-semibold mb-2">
                  <i className="bi bi-exclamation-triangle me-1"></i>Esta acción es definitiva.
                </p>
                <label className="form-label small fw-semibold">Escriba <code>Ok</code> para confirmar:</label>
                <input className="form-control" autoFocus
                  placeholder="Ok"
                  value={anular.ok}
                  disabled={anular.loading}
                  onChange={e => setAnular(a => ({ ...a, ok: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && anular.ok.trim().toUpperCase() === 'OK') handleAnular(); }}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" disabled={anular.loading}
                  onClick={() => setAnular({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false })}>
                  Cancelar
                </button>
                <button className="btn btn-warning btn-sm fw-semibold"
                  disabled={anular.loading || anular.ok.trim().toUpperCase() !== 'OK'}
                  onClick={handleAnular}>
                  {anular.loading
                    ? <><span className="spinner-border spinner-border-sm me-1"></span>Anulando...</>
                    : <><i className="bi bi-slash-circle me-1"></i>Anular</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    {/* Modal Eliminar */}
      {eliminar.show && (
        <div className="modal fade show d-block" tabIndex="-1" style={{backgroundColor:'rgba(0,0,0,.5)'}}
          onClick={() => !eliminar.loading && setEliminar({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false })}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h6 className="modal-title fw-bold">
                  <i className="bi bi-trash me-2"></i>Eliminar movimiento
                </h6>
                <button type="button" className="btn-close btn-close-white" disabled={eliminar.loading}
                  onClick={() => setEliminar({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false })}></button>
              </div>
              <div className="modal-body">
                <p className="mb-3">
                  Se eliminará el movimiento <strong>{eliminar.cod_comprob}-{eliminar.num_comprob}</strong>
                  y todas sus líneas.
                </p>
                <p className="text-danger fw-semibold mb-2">
                  <i className="bi bi-exclamation-triangle me-1"></i>Esta acción es definitiva e irreversible.
                </p>
                <label className="form-label small fw-semibold">Escriba <code>Ok</code> para confirmar:</label>
                <input className="form-control" autoFocus
                  placeholder="Ok"
                  value={eliminar.ok}
                  disabled={eliminar.loading}
                  onChange={e => setEliminar(a => ({ ...a, ok: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && eliminar.ok.trim().toUpperCase() === 'OK') handleConfirmaEliminar(); }}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" disabled={eliminar.loading}
                  onClick={() => setEliminar({ show:false, cod_comprob:'', num_comprob:'', ok:'', loading:false })}>
                  Cancelar
                </button>
                <button className="btn btn-danger btn-sm fw-semibold"
                  disabled={eliminar.loading || eliminar.ok.trim().toUpperCase() !== 'OK'}
                  onClick={handleConfirmaEliminar}>
                  {eliminar.loading
                    ? <><span className="spinner-border spinner-border-sm me-1"></span>Eliminando...</>
                    : <><i className="bi bi-trash me-1"></i>Eliminar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ModalBuscador {...buscador.modalProps(datosBuscador())} />
    </MainLayout>
  );
}
