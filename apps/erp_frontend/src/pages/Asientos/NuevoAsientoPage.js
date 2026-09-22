import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import ModalBuscador from '../../components/common/ModalBuscador';
import { useBuscador } from '../../hooks/useBuscador';
import { createAsiento } from '../../api/asientos';
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

  const agregarLinea  = () => setLineas(p => [...p, { ...LINEA_VACIA }]);
  const eliminarLinea = i  => { if (lineas.length > 2) setLineas(p => p.filter((_,j) => j !== i)); };

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
            <button className="btn btn-outline-success btn-sm" onClick={agregarLinea}>
              <i className="bi bi-plus-lg me-1"></i>Agregar línea
            </button>
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
                    Cédula {F3_HINT}
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
                  <tr key={i}>
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
                    {/* Cédula / Tercero */}
                    <td>
                      <div className="input-group input-group-sm">
                        <input
                          className="form-control form-control-sm"
                          value={l.cedula}
                          placeholder="Cédula"
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
    </MainLayout>
  );
}