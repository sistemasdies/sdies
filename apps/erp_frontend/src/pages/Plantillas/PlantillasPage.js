import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import ModalBuscador from '../../components/common/ModalBuscador';
import { useBuscador } from '../../hooks/useBuscador';
import { getCuentas } from '../../api/cuentas';
import { getTerceros } from '../../api/terceros';
import { getCentrosCosto } from '../../api/centrosCosto';
import API from '../../api/client';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const api = {
  list:          ()        => API.get('/plantillas/'),
  get:           (id)      => API.get(`/plantillas/${id}/`),
  create:        (data)    => API.post('/plantillas/', data),
  update:        (id,data) => API.put(`/plantillas/${id}/`, data),
  remove:        (id)      => API.delete(`/plantillas/${id}/`),
  createDet:     (data)    => API.post('/plantillas/detalles/', data),
  updateDet:     (id,data) => API.put(`/plantillas/detalles/${id}/`, data),
  removeDet:     (id)      => API.delete(`/plantillas/detalles/${id}/`),
};

const TIPO_MOV = { D:'Débito', C:'Crédito' };
const DIGIT    = 'DIGITE';
const esDig    = v => v?.toString().toUpperCase().trim() === DIGIT;

const BadgeDig = () => (
  <span className="badge bg-warning text-dark ms-1" style={{fontSize:9,verticalAlign:'middle'}}>
    DIGITE
  </span>
);

export default function PlantillasPage() {
  const navigate = useNavigate();
  const buscador = useBuscador();
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  // Catálogos para buscador F3
  const [cuentas,  setCuentas]  = useState([]);
  const [terceros, setTerceros] = useState([]);
  const [centros,  setCentros]  = useState([]);
  const [plantillas,   setPlantillas]   = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [busqueda,     setBusqueda]     = useState('');

  // Modales
  const [modalCab,    setModalCab]    = useState(false);
  const [modalDet,    setModalDet]    = useState(false);
  const [modalDel,    setModalDel]    = useState(null);

  // Cabecera
  const [editando,  setEditando]  = useState(null);
  const [formCab,   setFormCab]   = useState({cod_plantilla:'',nombre:'',descripcion:'',comprobante:''});
  const [savingCab, setSavingCab] = useState(false);

  // Detalles
  const [plantActiva, setPlantActiva] = useState(null);
  const [detalles,    setDetalles]    = useState([]);
  const [loadingDet,  setLoadingDet]  = useState(false);
  const [editDet,     setEditDet]     = useState(null); // id o '_new_N'
  const [savingDet,   setSavingDet]   = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    api.list().then(r => setPlantillas(r.data.results||r.data))
              .catch(()=>{})
              .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
    API.get('/comprobantes/').then(r => setComprobantes(r.data.results||r.data)).catch(()=>{});
    getCuentas({ page_size: 5000 }).then(r => setCuentas(r.data.results||r.data)).catch(()=>{});
    getTerceros({ page_size: 2000 }).then(r => setTerceros(r.data.results||r.data)).catch(()=>{});
    getCentrosCosto().then(r => setCentros(r.data.results||r.data)).catch(()=>{});
  }, [cargar]);

  // ── Cabecera CRUD ─────────────────────────────────────────────────────
  const abrirNueva = () => {
    setEditando(null);
    setFormCab({cod_plantilla:'',nombre:'',descripcion:'',comprobante:''});
    setModalCab(true);
  };
  const abrirEditar = p => {
    setEditando(p);
    setFormCab({cod_plantilla:p.cod_plantilla,nombre:p.nombre,
                descripcion:p.descripcion||'',comprobante:p.comprobante||''});
    setModalCab(true);
  };
  const guardarCab = async e => {
    e.preventDefault();
    setSavingCab(true);
    try {
      editando ? await api.update(editando.id, formCab) : await api.create(formCab);
      toast.success(editando ? 'Plantilla actualizada' : 'Plantilla creada');
      setModalCab(false);
      cargar();
    } catch(err) {
      const d = err.response?.data;
      toast.error(d?.cod_plantilla?.[0]||d?.nombre?.[0]||d?.detail||'Error al guardar');
    } finally { setSavingCab(false); }
  };
  const confirmarEliminar = async () => {
    try {
      await api.remove(modalDel.id);
      toast.success('Plantilla eliminada');
      if (plantActiva?.id === modalDel.id) { setPlantActiva(null); setDetalles([]); }
      cargar();
    } catch { toast.error('No se puede eliminar'); }
    setModalDel(null);
  };

  // ── Detalles ──────────────────────────────────────────────────────────
  const abrirDetalles = async p => {
    setPlantActiva(p);
    setEditDet(null);
    setLoadingDet(true);
    setModalDet(true);
    try {
      const r = await api.get(p.id);
      setDetalles((r.data.detalles||[]).sort((a,b)=>a.item-b.item));
    } catch { toast.error('Error al cargar líneas'); }
    finally { setLoadingDet(false); }
  };

  const agregarLinea = () => {
    const nextItem = detalles.length ? Math.max(...detalles.map(d=>d.item))+1 : 1;
    const ult = detalles[detalles.length-1]||{};
    const nueva = {
      _new:true, item:nextItem,
      cuenta:ult.cuenta||'', observacion:ult.observacion||'',
      tipo_mov:'D', valor:'', base:'',
      cedula:ult.cedula||'', centro_costo:ult.centro_costo||'',
      comentarios:'', doc_soporte:'',
    };
    setDetalles(prev=>[...prev,nueva]);
    setEditDet('_new_'+nextItem);
  };

  const upd = (item, campo, valor) =>
    setDetalles(prev=>prev.map(d=>d.item===item?{...d,[campo]:valor}:d));

  const guardarTodo = async () => {
    setSavingDet(true);
    let ok = 0, fail = 0;
    // Renumerar items por posición actual antes de guardar
    const renumerados = detalles.map((d, i) => ({ ...d, item: i + 1 }));
    setDetalles(renumerados);
    try {
      for (const det of renumerados) {
        const payload = {
          plantilla:    plantActiva.id,
          item:         det.item,
          cuenta:       det.cuenta       || '',
          observacion:  det.observacion  || '',
          tipo_mov:     det.tipo_mov     || 'D',
          valor:        det.valor        || '',
          base:         det.base         || '',
          cedula:       det.cedula       || '',
          centro_costo: det.centro_costo || '',
          comentarios:  det.comentarios  || '',
          doc_soporte:  det.doc_soporte  || '',
        };
        try {
          if (det._new) {
            const r = await api.createDet(payload);
            setDetalles(prev => prev.map(d =>
              (d.item === det.item && d._new) ? { ...r.data, _new: false } : d
            ));
          } else {
            await api.updateDet(det.id, payload);
          }
          ok++;
        } catch { fail++; }
      }
      if (fail === 0) {
        toast.success(`Plantilla guardada — ${ok} línea(s)`);
      } else {
        toast.error(`${ok} guardadas, ${fail} con error`);
      }
    } finally { setSavingDet(false); }
  };

  const eliminarDet = async det => {
    if (det._new) {
      setDetalles(prev => prev.filter(d => !(d._new && d.item === det.item)));
      return;
    }
    try {
      await api.removeDet(det.id);
      setDetalles(prev => prev.filter(d => d.id !== det.id).map((d, i) => ({ ...d, item: i + 1 })));
      toast.success('Línea eliminada');
    } catch { toast.error('Error al eliminar'); }
  };

  const duplicar = det => {
    const nextItem = detalles.length ? Math.max(...detalles.map(d => d.item)) + 1 : 1;
    const copia = { ...det, _new: true, id: undefined, item: nextItem };
    setDetalles(prev => [...prev, copia]);
  };

  const mover = (idx, dir) => {
    const arr = [...detalles];
    const to  = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    setDetalles(arr.map((d, i) => ({ ...d, item: i + 1 })));
  };

  const filtradas = plantillas.filter(p=>
    p.cod_plantilla.toLowerCase().includes(busqueda.toLowerCase())||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const countDig = p => (p.detalles||[]).reduce((acc,d)=>
    acc+[d.cuenta,d.observacion,d.cedula,d.centro_costo,d.valor]
       .filter(v=>esDig(v)).length,0);

  return (
    <>
    <MainLayout>
      <TopBar title="Plantillas Contables"/>
      <div className="p-4">
        <PageHeader title="Plantillas Contables"
          subtitle={`${plantillas.length} plantilla(s)`}>
          <button className="btn btn-success" onClick={abrirNueva} disabled={!canAdd}>
            <i className="bi bi-plus-lg me-1"></i>Nueva plantilla
          </button>
        </PageHeader>

        {/* Buscador */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{maxWidth:380}}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input className="form-control border-start-0"
                placeholder="Buscar por código o nombre..."
                value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
              {busqueda&&<button className="btn btn-outline-secondary" onClick={()=>setBusqueda('')}>
                <i className="bi bi-x"></i></button>}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          {loading ? <div className="card-body"><Spinner/></div>
          : filtradas.length===0 ? (
            <div className="card-body">
              <EmptyState icon="bi-layout-text-window" title="Sin plantillas"
                subtitle="Crea la primera plantilla contable"
                action={<button className="btn btn-success mt-2" onClick={abrirNueva} disabled={!canAdd}>
                  <i className="bi bi-plus-lg me-1"></i>Crear ahora</button>}/>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-dark">
                  <tr>
                    <th style={{width:100}}>Código</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th className="text-center" style={{width:110}}>Comprobante</th>
                    <th className="text-center" style={{width:75}}>Líneas</th>
                    <th className="text-center" style={{width:75}}>DIGITE</th>
                    <th className="text-center" style={{width:180}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(p=>(
                    <tr key={p.id}>
                      <td><code className="fw-bold">{p.cod_plantilla}</code></td>
                      <td className="fw-semibold">{p.nombre}</td>
                      <td className="small text-muted">
                        {p.descripcion||<span className="fst-italic">—</span>}
                      </td>
                      <td className="text-center">
                        {p.comprobante
                          ? <span className="badge bg-info text-dark">{p.comprobante}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td className="text-center">
                        <span className="badge bg-secondary">{p.detalles?.length||0}</span>
                      </td>
                      <td className="text-center">
                        {countDig(p)>0
                          ? <span className="badge bg-warning text-dark">{countDig(p)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary"
                            onClick={()=>abrirDetalles(p)} title="Gestionar líneas">
                            <i className="bi bi-list-ul"></i>
                          </button>
                          <button className="btn btn-outline-secondary"
                            onClick={()=>abrirEditar(p)} title="Editar cabecera">
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-success"
                            onClick={()=>navigate('/asientos/plantilla')} title="Usar plantilla">
                            <i className="bi bi-play-fill"></i>
                          </button>
                          <button className="btn btn-outline-danger"
                            disabled={!canDel}
                            onClick={()=>setModalDel(p)} title="Eliminar">
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
        </div>
      </div>

      {/* ── Modal Cabecera ─────────────────────────────────────────────── */}
      {modalCab&&(
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-layout-text-window me-2"></i>
                  {editando?'Editar plantilla':'Nueva plantilla'}
                </h5>
                <button className="btn-close btn-close-white" onClick={()=>setModalCab(false)}></button>
              </div>
              <form onSubmit={guardarCab}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-4">
                      <label className="form-label small fw-semibold">
                        Código <span className="text-danger">*</span>
                      </label>
                      <input className="form-control text-uppercase font-monospace"
                        maxLength={7} value={formCab.cod_plantilla}
                        disabled={!!editando} placeholder="NOM001"
                        onChange={e=>setFormCab({...formCab,cod_plantilla:e.target.value.toUpperCase()})}
                        required/>
                      <div className="form-text">Máx. 7 caracteres</div>
                    </div>
                    <div className="col-8">
                      <label className="form-label small fw-semibold">
                        Nombre <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" value={formCab.nombre}
                        placeholder="Ej: Nómina mensual"
                        onChange={e=>setFormCab({...formCab,nombre:e.target.value})} required/>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Descripción</label>
                      <input className="form-control" value={formCab.descripcion}
                        placeholder="Descripción opcional"
                        onChange={e=>setFormCab({...formCab,descripcion:e.target.value})}/>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Comprobante predeterminado</label>
                      <select className="form-select" value={formCab.comprobante}
                        onChange={e=>setFormCab({...formCab,comprobante:e.target.value})}>
                        <option value="">— Sin predeterminado —</option>
                        {comprobantes.map(c=>(
                          <option key={c.id} value={c.codigo}>{c.codigo} — {c.descripcion}</option>
                        ))}
                      </select>
                      <div className="form-text">
                        Se asignará automáticamente al crear el asiento
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary"
                    onClick={()=>setModalCab(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={!canAdd || savingCab}>
                    {savingCab
                      ?<><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                      :<><i className="bi bi-check2 me-1"></i>Guardar</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Detalles ─────────────────────────────────────────────── */}
      {modalDet&&plantActiva&&(
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-list-ul me-2"></i>
                  Líneas — <strong>{plantActiva.cod_plantilla}</strong>: {plantActiva.nombre}
                </h5>
                <button className="btn-close btn-close-white"
                  onClick={()=>{setModalDet(false);cargar();}}></button>
              </div>

              {/* Leyenda */}
              <div className="px-3 py-2 d-flex align-items-start gap-2"
                style={{background:'#fffbeb',borderBottom:'1px solid #fde68a'}}>
                <i className="bi bi-lightbulb-fill text-warning mt-1"></i>
                <div className="small text-warning-emphasis">
                  Escribe <code className="bg-warning px-1 rounded text-dark">DIGITE</code> para
                  que el sistema pida ese valor al crear el asiento.&nbsp;
                  Deja el campo <strong>vacío</strong> para heredar el valor del renglón anterior.
                  El campo <strong>Tipo</strong> define si la cuenta va en Débito (D) o Crédito (C).
                </div>
              </div>

              <div className="modal-body p-0">
                {loadingDet ? <div className="p-4"><Spinner/></div> : (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0 align-middle"
                      style={{minWidth:940}}>
                      <thead className="table-dark sticky-top">
                        <tr>
                          <th style={{width:64}} className="text-center">#</th>
                          <th style={{width:120}}>Cuenta</th>
                          <th style={{width:200}}>Observación</th>
                          <th style={{width:100}} className="text-center">Tipo mov.</th>
                          <th style={{width:130}} className="text-end">Valor</th>
                          <th style={{width:120}}>Base</th>
                          <th style={{width:130}}>Cédula</th>
                          <th style={{width:100}}>C. Costo</th>
                          <th style={{width:140}} className="text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalles.length===0&&(
                          <tr><td colSpan={9} className="text-center text-muted py-5">
                            Sin líneas — haz clic en "Agregar línea"
                          </td></tr>
                        )}
                        {detalles.map((det,idx)=>(
                          <tr key={det._new?'_n'+det.item:det.id}>
                            {/* Número + flechas */}
                            <td className="text-center">
                              <span className="badge bg-secondary d-block mb-1">{det.item}</span>
                              <div className="d-flex justify-content-center gap-0">
                                <button className="btn btn-link btn-sm p-0 text-muted"
                                  onClick={()=>mover(idx,-1)} disabled={idx===0}
                                  title="Subir" style={{fontSize:11}}>
                                  <i className="bi bi-chevron-up"></i>
                                </button>
                                <button className="btn btn-link btn-sm p-0 text-muted"
                                  onClick={()=>mover(idx,1)} disabled={idx===detalles.length-1}
                                  title="Bajar" style={{fontSize:11}}>
                                  <i className="bi bi-chevron-down"></i>
                                </button>
                              </div>
                            </td>

                            {/* ── Siempre en modo edición ── */}
                            <>
                              {/* CUENTA + F3 */}
                              <td>
                                <div className="input-group input-group-sm">
                                  <input className="form-control form-control-sm font-monospace"
                                    value={det.cuenta} placeholder="Código / DIGITE"
                                    list={`plt-det-cuentas-${det.item}`}
                                    title={cuentas.find(c=>c.codigo===det.cuenta)?.descripcion || ''}
                                    onChange={e=>upd(det.item,'cuenta',e.target.value)}
                                    onKeyDown={e=>{
                                      if(e.key==='F3'){
                                        e.preventDefault();
                                        buscador.abrir('cuenta', det.item, (item, itemNum) =>
                                          upd(itemNum, 'cuenta', item.codigo)
                                        );
                                      }
                                    }}
                                  />
                                  <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                    title="Buscar cuenta (F3)"
                                    onClick={()=>buscador.abrir('cuenta', det.item, (item, itemNum) =>
                                      upd(itemNum, 'cuenta', item.codigo)
                                    )}>
                                    <i className="bi bi-search" style={{fontSize:10}}></i>
                                  </button>
                                  <datalist id={`plt-det-cuentas-${det.item}`}>
                                    {cuentas.map(c=><option key={c.id} value={c.codigo}>{c.descripcion}</option>)}
                                  </datalist>
                                </div>
                              </td>
                              <td>
                                <input className="form-control form-control-sm"
                                  value={det.observacion} placeholder="Texto / DIGITE"
                                  onChange={e=>upd(det.item,'observacion',e.target.value)}/>
                              </td>
                              <td>
                                <select className="form-select form-select-sm" value={det.tipo_mov}
                                  onChange={e=>upd(det.item,'tipo_mov',e.target.value)}>
                                  <option value="D">D — Débito</option>
                                  <option value="C">C — Crédito</option>
                                </select>
                              </td>
                              <td>
                                <input className="form-control form-control-sm text-end"
                                  value={det.valor} placeholder="Número / DIGITE"
                                  onChange={e=>upd(det.item,'valor',e.target.value)}/>
                              </td>
                              <td>
                                <input className="form-control form-control-sm"
                                  value={det.base} placeholder="Base / DIGITE"
                                  onChange={e=>upd(det.item,'base',e.target.value)}/>
                              </td>
                              {/* CÉDULA + F3 */}
                              <td>
                                <div className="input-group input-group-sm">
                                  <input className="form-control form-control-sm"
                                    value={det.cedula} placeholder="Cédula / DIGITE"
                                    list={`plt-det-terceros-${det.item}`}
                                    title={terceros.find(t=>t.cedula===det.cedula)?.nombre_completo || ''}
                                    onChange={e=>upd(det.item,'cedula',e.target.value)}
                                    onKeyDown={e=>{
                                      if(e.key==='F3'){
                                        e.preventDefault();
                                        buscador.abrir('tercero', det.item, (item, itemNum) =>
                                          upd(itemNum, 'cedula', item.cedula)
                                        );
                                      }
                                    }}
                                  />
                                  <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                    title="Buscar tercero (F3)"
                                    onClick={()=>buscador.abrir('tercero', det.item, (item, itemNum) =>
                                      upd(itemNum, 'cedula', item.cedula)
                                    )}>
                                    <i className="bi bi-search" style={{fontSize:10}}></i>
                                  </button>
                                  <datalist id={`plt-det-terceros-${det.item}`}>
                                    {terceros.map(t=><option key={t.id} value={t.cedula}>{t.nombre_completo}</option>)}
                                  </datalist>
                                </div>
                              </td>
                              {/* CENTRO COSTO + F3 */}
                              <td>
                                <div className="input-group input-group-sm">
                                  <input className="form-control form-control-sm font-monospace"
                                    value={det.centro_costo} placeholder="CC / DIGITE"
                                    list={`plt-det-cc-${det.item}`}
                                    title={centros.find(c=>c.codigo===det.centro_costo)?.descripcion || ''}
                                    onChange={e=>upd(det.item,'centro_costo',e.target.value)}
                                    onKeyDown={e=>{
                                      if(e.key==='F3'){
                                        e.preventDefault();
                                        buscador.abrir('cc', det.item, (item, itemNum) =>
                                          upd(itemNum, 'centro_costo', item.codigo)
                                        );
                                      }
                                    }}
                                  />
                                  <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                                    title="Buscar centro de costo (F3)"
                                    onClick={()=>buscador.abrir('cc', det.item, (item, itemNum) =>
                                      upd(itemNum, 'centro_costo', item.codigo)
                                    )}>
                                    <i className="bi bi-search" style={{fontSize:10}}></i>
                                  </button>
                                  <datalist id={`plt-det-cc-${det.item}`}>
                                    {centros.map(c=><option key={c.id} value={c.codigo}>{c.descripcion}</option>)}
                                  </datalist>
                                </div>
                              </td>
                              {/* Acciones: Duplicar + Eliminar */}
                              <td className="text-center">
                                <div className="d-flex gap-1 justify-content-center">
                                  <button className="btn btn-outline-success btn-sm"
                                    onClick={()=>duplicar(det)} title="Duplicar línea">
                                    <i className="bi bi-copy"></i>
                                  </button>
                                  <button className="btn btn-outline-danger btn-sm"
                                    disabled={!canDel}
                                    onClick={()=>eliminarDet(det)} title="Eliminar">
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </>
                          </tr>
                        ))}
                      </tbody>

                      {/* Pie de tabla */}
                      {detalles.length>0&&(
                        <tfoot className="table-secondary small">
                          <tr>
                            <td colSpan={3} className="text-muted px-3">
                              {detalles.length} línea(s) &nbsp;|&nbsp;
                              <span className="text-info">
                                {detalles.filter(d=>d.tipo_mov==='D').length} débitos
                              </span> &nbsp;|&nbsp;
                              <span className="text-warning">
                                {detalles.filter(d=>d.tipo_mov==='C').length} créditos
                              </span>
                            </td>
                            <td colSpan={6} className="text-muted">
                              {detalles.filter(d=>
                                [d.cuenta,d.observacion,d.cedula,d.centro_costo,d.valor]
                                .some(v=>esDig(v))).length} línea(s) con campos DIGITE
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer d-flex justify-content-between">
                <div className="d-flex gap-2">
                  <button className="btn btn-success btn-sm" onClick={agregarLinea} disabled={!canAdd}>
                    <i className="bi bi-plus-lg me-1"></i>Agregar línea
                  </button>
                </div>
                <button className="btn btn-primary"
                  disabled={!canAdd || savingDet}
                  onClick={async () => { await guardarTodo(); setModalDet(false); cargar(); }}>
                  {savingDet
                    ? <><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                    : <><i className="bi bi-check2 me-1"></i>Guardar y Cerrar</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar eliminar ────────────────────────────────────── */}
      {modalDel&&(
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:420}}>
            <div className="modal-content shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>Eliminar plantilla
                </h5>
                <button className="btn-close" onClick={()=>setModalDel(null)}></button>
              </div>
              <div className="modal-body pt-2">
                <p className="mb-2">¿Eliminar la plantilla:</p>
                <div className="bg-light rounded p-3 mb-3">
                  <strong>{modalDel.cod_plantilla}</strong> — {modalDel.nombre}
                  <div className="text-muted small mt-1">
                    {modalDel.detalles?.length||0} línea(s) configurada(s)
                  </div>
                </div>
                <p className="text-muted small mb-0">
                  Los asientos ya creados con esta plantilla no se verán afectados.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-secondary"
                  onClick={()=>setModalDel(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={confirmarEliminar} disabled={!canDel}>
                  <i className="bi bi-trash me-1"></i>Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>

      {/* ── Modal Buscador F3 ── */}
      <ModalBuscador
        show={buscador.estado.show}
        tipo={buscador.estado.tipo}
        datos={
          buscador.estado.tipo === 'cuenta'  ? cuentas  :
          buscador.estado.tipo === 'tercero' ? terceros :
          buscador.estado.tipo === 'cc'      ? centros  : []
        }
        onSelect={(item) => {
          const { onSelect, contexto } = buscador.estado;
          if (onSelect) onSelect(item, contexto);
          buscador.cerrar();
        }}
        onClose={buscador.cerrar}
      />
    </>
  );
}