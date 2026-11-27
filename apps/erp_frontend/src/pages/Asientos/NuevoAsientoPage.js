import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import ModalBuscador from '../../components/common/ModalBuscador';
import AvisoCierre from '../../components/common/AvisoCierre';
import { useBuscador } from '../../hooks/useBuscador';
import { createAsiento, getAsientos, getMovimiento } from '../../api/asientos';
import { getComprobantes } from '../../api/comprobantes';
import { getCuentas } from '../../api/cuentas';
import { getTerceros } from '../../api/terceros';
import { getCentrosCosto } from '../../api/centrosCosto';
import { formatMoney } from '../../utils/formato';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const LINEA_VACIA = {
  cuenta:'', cuenta_desc:'', observacion:'',
  vr_debitos:'', vr_creditos:'',
  cedula:'', tercero_nombre:'', centro_costo:'',
};

const F3_HINT = (
  <span className="text-muted" style={{fontSize:10}}>
    &nbsp;<kbd style={{fontSize:9}}>F3</kbd>
  </span>
);

export default function NuevoAsientoPage() {
  const navigate  = useNavigate();
  const buscador  = useBuscador();
  const { canAdd, canDel } = usePerm('/asientos');

  const [comprobantes, setComprobantes] = useState([]);
  const [cuentas,      setCuentas]      = useState([]);
  const [terceros,     setTerceros]     = useState([]);
  const [centros,      setCentros]      = useState([]);
  const [saving,       setSaving]       = useState(false);

  const [cabecera, setCabecera] = useState({
    cod_comprob:'', fecha: new Date().toISOString().split('T')[0],
    doc_ref:'', doc_soporte:'',
  });
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }, { ...LINEA_VACIA }]);
  const [filaActiva, setFilaActiva] = useState(null);
  const [imitar, setImitar] = useState({ show:false, cargando:false, items:[], query:'' });

  useEffect(() => {
    Promise.allSettled([
      getComprobantes(),
      getCuentas({ page_size: 5000 }),
      getTerceros({ page_size: 2000 }),
      getCentrosCosto(),
    ]).then(([c, cu, t, cc]) => {
      if (c.status  === 'fulfilled') setComprobantes(c.value.data.results  || c.value.data);
      if (cu.status === 'fulfilled') setCuentas(     cu.value.data.results || cu.value.data);
      if (t.status  === 'fulfilled') setTerceros(    t.value.data.results  || t.value.data);
      if (cc.status === 'fulfilled') setCentros(     cc.value.data.results || cc.value.data);
    });
  }, []);

  // ── Totales ──────────────────────────────────────────────────────────────
  const totalDeb = lineas.reduce((s,l) => s + (parseFloat(l.vr_debitos)  || 0), 0);
  const totalCre = lineas.reduce((s,l) => s + (parseFloat(l.vr_creditos) || 0), 0);
  const cuadra   = Math.abs(totalDeb - totalCre) < 0.01;

  // ── Actualizar línea ─────────────────────────────────────────────────────
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

  // Actualiza varios campos a la vez en una sola llamada (evita sobreescritura)
  const updateLineaCampos = (idx, cambios) => {
    setLineas(prev => {
      const arr = [...prev];
      arr[idx]  = { ...arr[idx], ...cambios };
      return arr;
    });
  };

  // Duplica el renglón donde está el cursor y lo inserta justo debajo.
  // Si ningún renglón tiene el foco, se agrega al final como antes.
  const agregarLinea = () => {
    setLineas(prev => {
      const idx = filaActiva !== null && filaActiva < prev.length ? filaActiva : prev.length - 1;
      const arr = [...prev];
      arr.splice(idx + 1, 0, { ...prev[idx] });
      return arr;
    });
  };
  const eliminarLinea = i  => { if (lineas.length > 2) setLineas(p => p.filter((_,j) => j !== i)); };

  // ── Imitar asiento existente ──────────────────────────────────────────────
  const abrirImitar = async () => {
    const cod = (cabecera.cod_comprob || '').trim();
    if (!cod) { toast.error('Seleccione un comprobante'); return; }
    setImitar({ show:true, cargando:true, items:[], query:'' });
    try {
      const r = await getAsientos({ comprobante: cod, page_size: 1000 });
      setImitar(prev => ({ ...prev, cargando:false, items: r.data?.results || r.data || [] }));
    } catch (err) {
      toast.error('Error al cargar los asientos existentes');
      setImitar(prev => ({ ...prev, cargando:false }));
    }
  };

  const copiarAsiento = async (a) => {
    setImitar(prev => ({ ...prev, cargando:true }));
    try {
      const r = await getMovimiento({
        cod_comprob: a.cod_comprob, num_comprob: a.num_comprob,
      });
      const copiadas = (r.data || []).map(l => ({
        cuenta:         l.cuenta            || '',
        cuenta_desc:    l.cuenta_descripcion || '',
        observacion:    l.observacion       || '',
        vr_debitos:     l.vr_debitos  ?? '',
        vr_creditos:    l.vr_creditos ?? '',
        cedula:         l.cedula            || '',
        tercero_nombre: l.tercero_nombre    || '',
        centro_costo:   l.centro_costo      || '',
      }));
      if (!copiadas.length) {
        toast.error('El asiento seleccionado no tiene líneas');
        setImitar(prev => ({ ...prev, cargando:false }));
        return;
      }
      // Solo se reemplazan las líneas: fecha y número de comprobante se conservan.
      setLineas(copiadas);
      setImitar(prev => ({ ...prev, show:false, cargando:false }));
      toast.success(`Asiento ${a.referencia || `${a.cod_comprob}-${a.num_comprob}`} imitado`);
    } catch (err) {
      toast.error('Error al copiar las líneas del asiento');
      setImitar(prev => ({ ...prev, cargando:false }));
    }
  };

  const imitarFiltrados = imitar.items.filter(a =>
    !imitar.query ||
    String(a.num_comprob).includes(imitar.query) ||
    (a.referencia || '').toLowerCase().includes(imitar.query.toLowerCase()) ||
    (a.fecha || '').includes(imitar.query)
  );

  // ── Handlers F3 por tipo ─────────────────────────────────────────────────
  const f3Cuenta = (e, idx) => buscador.onKeyDown(e, 'cuenta', idx, (item, i) => {
    updateLinea(i, 'cuenta', item.codigo);
  });

  const f3Tercero = (e, idx) => buscador.onKeyDown(e, 'tercero', idx, (item, i) => {
    updateLineaCampos(i, {
      cedula:         item.cedula,
      tercero_nombre: item.nombre_completo,
    });
  });

  const f3CC = (e, idx) => buscador.onKeyDown(e, 'cc', idx, (item, i) => {
    updateLinea(i, 'centro_costo', item.codigo);
  });

  const f3Comprob = (e) => buscador.onKeyDown(e, 'comprobante', null, (item) => {
    setCabecera(prev => ({ ...prev, cod_comprob: item.codigo }));
  });

  // ── Guardar ──────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!cabecera.cod_comprob) { toast.error('Seleccione un comprobante'); return; }
    if (!cuadra)               { toast.error('El asiento no cuadra');       return; }
    const validas = lineas.filter(l =>
      l.cuenta && (parseFloat(l.vr_debitos) > 0 || parseFloat(l.vr_creditos) > 0)
    );
    if (validas.length < 2) { toast.error('Mínimo 2 líneas con valores'); return; }

    setSaving(true);
    try {
      const payload = {
        ...cabecera,
        lineas: validas.map((l, i) => ({
          item_comprob: i + 1,
          cuenta:       l.cuenta,
          observacion:  l.observacion,
          vr_debitos:   parseFloat(l.vr_debitos)  || 0,
          vr_creditos:  parseFloat(l.vr_creditos) || 0,
          cedula:       l.cedula        || null,
          centro_costo: l.centro_costo  || null,
        })),
      };
      await createAsiento(payload);
      toast.success('Movimiento guardado');
      navigate(`/asientos?cod_comprob=${cabecera.cod_comprob}`);
    } catch (err) {
      const d = err.response?.data?.detail || err.response?.data?.lineas;
      toast.error(Array.isArray(d) ? d[0] : (d || 'Error al guardar'));
    } finally { setSaving(false); }
  };

  // ── Datos para el modal buscador según tipo activo ───────────────────────
  const datosBuscador = () => {
    const t = buscador.estado.tipo;
    if (t === 'cuenta')      return cuentas;
    if (t === 'tercero')     return terceros;
    if (t === 'cc')          return centros;
    if (t === 'comprobante') return comprobantes;
    return [];
  };

  return (
    <MainLayout>
      <TopBar title="Nuevo Asiento"/>
      <div className="p-4">
        <div className="d-flex align-items-center gap-3 mb-4">
          <button className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate('/asientos')}>
            <i className="bi bi-arrow-left me-1"></i>Volver
          </button>
          <h4 className="mb-0 fw-bold">Nuevo Asiento Contable</h4>
          <span className="text-muted small ms-auto">
            <kbd>F3</kbd> en cualquier campo para buscar
          </span>
        </div>

        <AvisoCierre />

        {/* ── Cabecera ── */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white fw-semibold">
            <i className="bi bi-file-text me-2 text-success"></i>Datos del comprobante
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label small fw-semibold">
                  Comprobante * {F3_HINT}
                </label>
                <div className="input-group">
                  <input className="form-control" value={cabecera.cod_comprob}
                    placeholder="Código o F3 para buscar"
                    onChange={e => setCabecera({...cabecera, cod_comprob: e.target.value})}
                    onKeyDown={f3Comprob}
                    list="list-comprob"
                  />
                  <button className="btn btn-outline-secondary"
                    type="button" tabIndex={-1}
                    onClick={() => buscador.abrir('comprobante', null, (item) =>
                      setCabecera(p => ({...p, cod_comprob: item.codigo}))
                    )}>
                    <i className="bi bi-search"></i>
                  </button>
                  <datalist id="list-comprob">
                    {comprobantes.map(c =>
                      <option key={c.id} value={c.codigo}>{c.descripcion}</option>)}
                  </datalist>
                </div>
                {cabecera.cod_comprob && (
                  <div className="form-text text-success">
                    {comprobantes.find(c=>c.codigo===cabecera.cod_comprob)?.descripcion}
                  </div>
                )}
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Fecha *</label>
                <input type="date" className="form-control" value={cabecera.fecha}
                  onChange={e => setCabecera({...cabecera, fecha: e.target.value})}/>
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Doc. Referencia</label>
                <input className="form-control" value={cabecera.doc_ref}
                  onChange={e => setCabecera({...cabecera, doc_ref: e.target.value})}/>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Soporte</label>
                <input className="form-control" value={cabecera.doc_soporte}
                  onChange={e => setCabecera({...cabecera, doc_soporte: e.target.value})}/>
              </div>
            </div>
          </div>
        </div>

        {/* ── Líneas ── */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-semibold">
              <i className="bi bi-list-ul me-2 text-success"></i>Líneas del asiento
            </span>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-success btn-sm" onClick={agregarLinea}>
                <i className="bi bi-plus-lg me-1"></i>Agregar línea
              </button>
              <button className="btn btn-outline-primary btn-sm" onClick={abrirImitar}
                disabled={!cabecera.cod_comprob?.trim()} title="Copiar líneas de un asiento existente">
                <i className="bi bi-copy me-1"></i>Imitar asiento
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th style={{width:120}}>
                    Cuenta {F3_HINT}
                  </th>
                  <th style={{width:'8%'}}>Descripción cuenta</th>
                  <th style={{width:475}}>Observación</th>
                  <th style={{width:130}}>
                    Cedula {F3_HINT}
                  </th>
                  <th style={{width:260}}>Tercero</th>
                  <th style={{width:100}}>
                    C.Costo {F3_HINT}
                  </th>
                  <th style={{width:130}} className="text-end">Débito</th>
                  <th style={{width:130}} className="text-end">Crédito</th>
                  <th style={{width:36}}></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} onFocus={() => setFilaActiva(i)}>
                    {/* Cuenta */}
                    <td>
                      <div className="input-group input-group-sm">
                        <input
                          className="form-control form-control-sm font-monospace"
                          value={l.cuenta}
                          placeholder="Código"
                          list={`cuentas-${i}`}
                          onChange={e => updateLinea(i,'cuenta',e.target.value)}
                          onKeyDown={e => f3Cuenta(e, i)}
                          title="F3 para buscar"
                        />
                        <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                          onClick={() => buscador.abrir('cuenta', i, (item, idx) =>
                            updateLinea(idx,'cuenta',item.codigo))}>
                          <i className="bi bi-search" style={{fontSize:10}}></i>
                        </button>
                        <datalist id={`cuentas-${i}`}>
                          {cuentas.map(c =>
                            <option key={c.id} value={c.codigo}>{c.descripcion}</option>)}
                        </datalist>
                      </div>
                    </td>
                    {/* Descripción cuenta */}
                    <td>
                      <input className="form-control form-control-sm bg-light" readOnly
                        value={l.cuenta_desc} placeholder="Nombre cuenta"/>
                    </td>
                    {/* Observación */}
                    <td>
                      <input className="form-control form-control-sm"
                        value={l.observacion}
                        onChange={e => updateLinea(i,'observacion',e.target.value)}/>
                    </td>
                    {/* Cedula / Tercero */}
                    <td>
                      <div className="input-group input-group-sm">
                        <input
                          className="form-control form-control-sm"
                          value={l.cedula}
                          placeholder="Código"
                          list={`terceros-${i}`}
                          onChange={e => updateLinea(i,'cedula',e.target.value)}
                          onKeyDown={e => f3Tercero(e, i)}
                          title="F3 para buscar"
                        />
                        <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                          onClick={() => buscador.abrir('tercero', i, (item, idx) => {
                            updateLineaCampos(idx, {
                              cedula:         item.cedula,
                              tercero_nombre: item.nombre_completo,
                            });
                          })}>
                          <i className="bi bi-search" style={{fontSize:10}}></i>
                        </button>
                        <datalist id={`terceros-${i}`}>
                          {terceros.map(t =>
                            <option key={t.id} value={t.cedula}>{t.nombre_completo}</option>)}
                        </datalist>
                      </div>
                    </td>
                    {/* Nombre tercero */}
                    <td>
                      <input className="form-control form-control-sm bg-light" readOnly
                        value={l.tercero_nombre} placeholder="Nombre tercero"/>
                    </td>
                    {/* Centro costo */}
                    <td>
                      <div className="input-group input-group-sm">
                        <input
                          className="form-control form-control-sm font-monospace"
                          value={l.centro_costo}
                          placeholder="CC"
                          list={`cc-${i}`}
                          onChange={e => updateLinea(i,'centro_costo',e.target.value)}
                          onKeyDown={e => f3CC(e, i)}
                          title="F3 para buscar"
                        />
                        <button className="btn btn-outline-secondary btn-sm" tabIndex={-1}
                          onClick={() => buscador.abrir('cc', i, (item, idx) =>
                            updateLinea(idx,'centro_costo',item.codigo))}>
                          <i className="bi bi-search" style={{fontSize:10}}></i>
                        </button>
                        <datalist id={`cc-${i}`}>
                          {centros.map(c =>
                            <option key={c.id} value={c.codigo}>{c.descripcion}</option>)}
                        </datalist>
                      </div>
                    </td>
                    {/* Débito */}
                    <td>
                      <input type="number" min="0" step="0.01"
                        className="form-control form-control-sm text-end"
                        value={l.vr_debitos} placeholder="0.00"
                        onChange={e => updateLinea(i,'vr_debitos',e.target.value)}/>
                    </td>
                    {/* Crédito */}
                    <td>
                      <input type="number" min="0" step="0.01"
                        className="form-control form-control-sm text-end"
                        value={l.vr_creditos} placeholder="0.00"
                        onChange={e => updateLinea(i,'vr_creditos',e.target.value)}/>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-danger"
                        onClick={() => eliminarLinea(i)} disabled={!canDel || lineas.length <= 2}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className={cuadra ? 'table-success' : 'table-danger'}>
                <tr>
                  <td colSpan={6} className="text-end fw-semibold">
                    {cuadra
                      ? <><i className="bi bi-check-circle-fill text-success me-1"></i>Cuadra</>
                      : <><i className="bi bi-x-circle-fill text-danger me-1"></i>
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

        {/* ── Botones ── */}
        <div className="d-flex gap-2 justify-content-end">
          <button className="btn btn-secondary" onClick={() => navigate('/asientos')}>
            Cancelar
          </button>
          <button className="btn btn-success" disabled={saving || !cuadra || !canAdd}
            onClick={guardar}>
            {saving
              ? <><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
              : <><i className="bi bi-check2-all me-1"></i>Guardar movimiento</>}
          </button>
        </div>
      </div>

      {/* ── Modal Buscador ── */}
      <ModalBuscador {...buscador.modalProps(datosBuscador())} />

      {/* ── Modal Imitar asiento ── */}
      {imitar.show && (
        <div className="modal fade show d-block" tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,.5)' }}
          onClick={() => setImitar(p => ({ ...p, show:false }))}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable"
            onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header" style={{ justifyContent:'flex-start' }}>
                <h6 className="modal-title mb-0">
                  <i className="bi bi-copy me-2 text-primary"></i>
                  Imitar asiento · {cabecera.cod_comprob}
                </h6>
                <button type="button" className="btn-close ms-auto"
                  onClick={() => setImitar(p => ({ ...p, show:false }))}></button>
              </div>
              <div className="modal-body">
                <div className="form-text mb-2">
                  Se copiarán solo las líneas. La fecha y el número de comprobante serán los del nuevo asiento.
                </div>
                <input className="form-control form-control-sm mb-3"
                  placeholder="Filtrar por número, referencia o fecha..."
                  value={imitar.query}
                  onChange={e => setImitar(p => ({ ...p, query: e.target.value }))} />
                {imitar.cargando ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span className="ms-2 small text-muted">Cargando asientos...</span>
                  </div>
                ) : imitarFiltrados.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    No hay asientos existentes para este comprobante.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Referencia</th>
                          <th>Fecha</th>
                          <th className="text-center">Líneas</th>
                          <th className="text-end">Débito</th>
                          <th className="text-end">Crédito</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {imitarFiltrados.map(a => (
                          <tr key={a.num_comprob}>
                            <td className="font-monospace fw-semibold">{a.referencia}</td>
                            <td>{a.fecha}</td>
                            <td className="text-center">{a.num_lineas}</td>
                            <td className="text-end">{formatMoney(a.total_debitos)}</td>
                            <td className="text-end">{formatMoney(a.total_creditos)}</td>
                            <td className="text-end">
                              <button className="btn btn-sm btn-outline-primary"
                                disabled={imitar.cargando}
                                onClick={() => copiarAsiento(a)}>
                                <i className="bi bi-copy me-1"></i>Imitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}