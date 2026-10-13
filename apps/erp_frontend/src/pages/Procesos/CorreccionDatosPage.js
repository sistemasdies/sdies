import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import MultiSelect from '../../components/common/MultiSelect';
import { previewCorreccion, aplicarCorreccion, getBorradoDuro, ejecutarBorradoDuro } from '../../api/correccionDatos';
import { getCuentas } from '../../api/cuentas';
import { getCentrosCosto } from '../../api/centrosCosto';
import { getTerceros } from '../../api/terceros';
import { getComprobantes } from '../../api/comprobantes';
import { getPlantillas } from '../../api/plantillas';
import { formatDate } from '../../utils/formato';
import toast from 'react-hot-toast';

const TABLAS = [
  { id: 'movicont',       label: 'Movimientos (MoviCont)',  icon: 'bi-journal-text' },
  { id: 'plantillas',     label: 'Plantillas (títulos)',    icon: 'bi-journals' },
  { id: 'det_plantillas', label: 'Detalle de Plantillas',   icon: 'bi-list-ul' },
];

const FILTROS_DEFAULT = {
  movicont: {
    fecha_desde: '', fecha_hasta: '', comprobante: [], cuenta: [], centro_costo: [],
    cedula: [], doc_ref: '', doc_soporte: '', observacion: '',
    num_min: '', num_max: '', deb_min: '', deb_max: '', cre_min: '', cre_max: '',
  },
  plantillas: { cod_plantilla: '', nombre: '', descripcion: '', comprobante: [] },
  det_plantillas: {
    plantilla: [], item: '', cuenta: [], doc_ref: '', observacion: '', tipo_mov: '',
    cedula: [], centro_costo: [], comentarios: '', doc_soporte: '', valor: '', base: '',
  },
};

const PISTA_TABLA = {
  movicont:       'Movimientos contables (cabecera y líneas en una sola tabla).',
  plantillas:     'Títulos de plantillas contables.',
  det_plantillas: 'Renglones de las plantillas contables.',
};

export default function CorreccionDatosPage() {
  const [tabla, setTabla]       = useState('movicont');
  const [filtros, setFiltros]   = useState(FILTROS_DEFAULT.movicont);
  const [opciones, setOpciones] = useState({ cuentas: [], centros: [], terceros: [], comprobantes: [], plantillas: [] });
  const [preview, setPreview]   = useState(null);
  const [acuse, setAcuse]       = useState(false);
  const [campo, setCampo]       = useState('');
  const [valor, setValor]       = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [bd, setBd] = useState({
    open: false, loading: false, preview: null, confirm: '', ejecutando: false, result: null,
  });

  useEffect(() => {
    getCuentas({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, cuentas: r.data.results || r.data }))).catch(() => {});
    getCentrosCosto().then(r => setOpciones(o => ({ ...o, centros: r.data.results || r.data }))).catch(() => {});
    getTerceros({ page_size: 10000 }).then(r => setOpciones(o => ({ ...o, terceros: r.data.results || r.data }))).catch(() => {});
    getComprobantes().then(r => setOpciones(o => ({ ...o, comprobantes: r.data.results || r.data }))).catch(() => {});
    getPlantillas().then(r => setOpciones(o => ({ ...o, plantillas: r.data.results || r.data }))).catch(() => {});
  }, []);

  const cambiarTabla = (t) => {
    setTabla(t);
    setFiltros(FILTROS_DEFAULT[t]);
    setPreview(null);
    setAcuse(false);
    setCampo('');
    setValor('');
    setConfirmText('');
  };

  const setFiltro = (k, v) => {
    setFiltros(f => ({ ...f, [k]: v }));
    setPreview(null);
    setAcuse(false);
  };

  const buscar = async () => {
    try {
      setCargando(true);
      const res = await previewCorreccion({ tabla, filtros });
      setPreview(res.data);
      setAcuse(false);
      setCampo('');
      setValor('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al buscar registros');
    } finally {
      setCargando(false);
    }
  };

  const campoDef = useMemo(
    () => preview?.campos_editables?.find(c => c.campo === campo) || null,
    [preview, campo]
  );

  const valorValido = () => {
    if (!campoDef) return false;
    if (campoDef.tipo === 'texto') return true;
    return String(valor).trim() !== '';
  };

  const puedeAplicar = acuse && valorValido() && confirmText.trim().toUpperCase() === 'CONFIRMAR' && !aplicando;

  const aplicar = async () => {
    if (!puedeAplicar) return;
    try {
      setAplicando(true);
      const res = await aplicarCorreccion({
        tabla, filtros, campo, valor, confirmacion: confirmText,
      });
      toast.success(`Se actualizaron ${res.data.actualizados} registro(s).`);
      setAcuse(false);
      setCampo('');
      setValor('');
      setConfirmText('');
      buscar();
    } catch (e) {
      const d = e.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.join(' ') : (d || 'Error al aplicar los cambios'));
    } finally {
      setAplicando(false);
    }
  };

  const cellValor = (col, fila) => {
    const v = fila[col.key];
    if (v === null || v === undefined || v === '') return '';
    if (col.key === 'fecha') return formatDate(v);
    return v;
  };

  const abrirBorradoDuro = async () => {
    setBd({ open: true, loading: true, preview: null, confirm: '', ejecutando: false, result: null });
    try {
      const res = await getBorradoDuro();
      setBd(b => ({ ...b, loading: false, preview: res.data }));
    } catch (e) {
      setBd(b => ({ ...b, loading: false }));
      toast.error(e.response?.data?.detail || 'Error al consultar los registros');
    }
  };

  const ejecutarBd = async () => {
    if (bd.confirm.trim().toUpperCase() !== 'BORRAR' || bd.ejecutando) return;
    try {
      setBd(b => ({ ...b, ejecutando: true }));
      const res = await ejecutarBorradoDuro(bd.confirm);
      setBd(b => ({ ...b, ejecutando: false, result: res.data, confirm: '' }));
      toast.success(`${res.data.total_eliminados} registro(s) eliminados definitivamente.`);
    } catch (e) {
      setBd(b => ({ ...b, ejecutando: false }));
      const d = e.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.join(' ') : (d || 'Error al ejecutar el borrado duro'));
    }
  };

  return (
    <MainLayout>
      <TopBar title="Corrección de Datos" />
      <div className="p-4">
        <PageHeader title="Corrección de Datos"
          subtitle="Modificación masiva de registros — filtre, confirme y aplique un cambio en bloque">
        </PageHeader>

        <div className="alert alert-warning border-0">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Esta herramienta <strong>se sobrescribe un campo en todos los registros que cumplan los filtros</strong>.
          Revise la vista previa y confirme antes de aplicar. La operación queda registrada en la bitácora.
        </div>

        {/* Paso 1: tabla */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="text-muted small fw-semibold mb-2">1. Elija la tabla</div>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div>
                <div className="btn-group flex-wrap">
                  {TABLAS.map(t => (
                    <button key={t.id} type="button"
                      className={`btn btn-sm ${tabla === t.id ? 'btn-success' : 'btn-outline-secondary'}`}
                      onClick={() => cambiarTabla(t.id)}>
                      <i className={`bi ${t.icon} me-1`}></i>{t.label}
                    </button>
                  ))}
                </div>
                <div className="text-muted small mt-2">{PISTA_TABLA[tabla]}</div>
              </div>
              <div className="text-md-end">
                <button type="button" className="btn btn-outline-danger btn-sm"
                  onClick={abrirBorradoDuro}>
                  <i className="bi bi-trash-fill me-1"></i>Borrado Duro
                </button>
                <div className="text-muted small mt-1" style={{ maxWidth: 280 }}>
                  Elimina definitivamente los registros con borrado suave de todas las tablas.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Paso 2: filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="text-muted small fw-semibold mb-3">2. Filtre los registros a modificar</div>

            {tabla === 'movicont' && (
              <>
                <div className="row g-2 mb-2">
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Fecha desde</label>
                    <input type="date" className="form-control form-control-sm"
                      value={filtros.fecha_desde} onChange={e => setFiltro('fecha_desde', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Fecha hasta</label>
                    <input type="date" className="form-control form-control-sm"
                      value={filtros.fecha_hasta} onChange={e => setFiltro('fecha_hasta', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Comprobante</label>
                    <MultiSelect options={opciones.comprobantes} value={filtros.comprobante}
                      onChange={v => setFiltro('comprobante', v)}
                      getKey={c => c.codigo} getLabel={c => `${c.codigo} - ${c.descripcion}`} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Cuenta</label>
                    <MultiSelect options={opciones.cuentas} value={filtros.cuenta}
                      onChange={v => setFiltro('cuenta', v)}
                      getKey={c => c.codigo} getLabel={c => `${c.codigo} - ${c.descripcion}`} />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Centro de costo</label>
                    <MultiSelect options={opciones.centros} value={filtros.centro_costo}
                      onChange={v => setFiltro('centro_costo', v)}
                      getKey={c => c.codigo} getLabel={c => `${c.codigo} - ${c.descripcion}`} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Cédula</label>
                    <MultiSelect options={opciones.terceros} value={filtros.cedula}
                      onChange={v => setFiltro('cedula', v)}
                      getKey={c => c.cedula} getLabel={c => `${c.cedula} - ${c.nombre_completo}`} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Doc. referencia contiene</label>
                    <input className="form-control form-control-sm" value={filtros.doc_ref}
                      onChange={e => setFiltro('doc_ref', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Doc. soporte contiene</label>
                    <input className="form-control form-control-sm" value={filtros.doc_soporte}
                      onChange={e => setFiltro('doc_soporte', e.target.value)} />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-md-6">
                    <label className="form-label small mb-0">Observación contiene</label>
                    <input className="form-control form-control-sm" value={filtros.observacion}
                      onChange={e => setFiltro('observacion', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Nº comprobante desde / hasta</label>
                    <div className="input-group input-group-sm">
                      <input type="number" className="form-control" value={filtros.num_min}
                        onChange={e => setFiltro('num_min', e.target.value)} />
                      <input type="number" className="form-control" value={filtros.num_max}
                        onChange={e => setFiltro('num_max', e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-md-4">
                    <label className="form-label small mb-0">Débitos desde / hasta</label>
                    <div className="input-group input-group-sm">
                      <input type="number" step="0.01" className="form-control" value={filtros.deb_min}
                        onChange={e => setFiltro('deb_min', e.target.value)} />
                      <input type="number" step="0.01" className="form-control" value={filtros.deb_max}
                        onChange={e => setFiltro('deb_max', e.target.value)} />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small mb-0">Créditos desde / hasta</label>
                    <div className="input-group input-group-sm">
                      <input type="number" step="0.01" className="form-control" value={filtros.cre_min}
                        onChange={e => setFiltro('cre_min', e.target.value)} />
                      <input type="number" step="0.01" className="form-control" value={filtros.cre_max}
                        onChange={e => setFiltro('cre_max', e.target.value)} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {tabla === 'plantillas' && (
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label small mb-0">Código contiene</label>
                  <input className="form-control form-control-sm" value={filtros.cod_plantilla}
                    onChange={e => setFiltro('cod_plantilla', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small mb-0">Nombre contiene</label>
                  <input className="form-control form-control-sm" value={filtros.nombre}
                    onChange={e => setFiltro('nombre', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small mb-0">Descripción contiene</label>
                  <input className="form-control form-control-sm" value={filtros.descripcion}
                    onChange={e => setFiltro('descripcion', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small mb-0">Comprobante</label>
                  <MultiSelect options={opciones.comprobantes} value={filtros.comprobante}
                    onChange={v => setFiltro('comprobante', v)}
                    getKey={c => c.codigo} getLabel={c => `${c.codigo} - ${c.descripcion}`} />
                </div>
              </div>
            )}

            {tabla === 'det_plantillas' && (
              <>
                <div className="row g-2 mb-2">
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Plantilla</label>
                    <MultiSelect options={opciones.plantillas} value={filtros.plantilla}
                      onChange={v => setFiltro('plantilla', v)}
                      getKey={p => p.cod_plantilla} getLabel={p => `${p.cod_plantilla} - ${p.nombre}`} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-0">Ítem</label>
                    <input type="number" className="form-control form-control-sm" value={filtros.item}
                      onChange={e => setFiltro('item', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Cuenta</label>
                    <MultiSelect options={opciones.cuentas} value={filtros.cuenta}
                      onChange={v => setFiltro('cuenta', v)}
                      getKey={c => c.codigo} getLabel={c => `${c.codigo} - ${c.descripcion}`} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-0">Tipo mov.</label>
                    <select className="form-select form-select-sm" value={filtros.tipo_mov}
                      onChange={e => setFiltro('tipo_mov', e.target.value)}>
                      <option value="">Todos</option>
                      <option value="D">D (débito)</option>
                      <option value="C">C (crédito)</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-0">Cédula</label>
                    <MultiSelect options={opciones.terceros} value={filtros.cedula}
                      onChange={v => setFiltro('cedula', v)}
                      getKey={c => c.cedula} getLabel={c => `${c.cedula} - ${c.nombre_completo}`} />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Centro de costo</label>
                    <MultiSelect options={opciones.centros} value={filtros.centro_costo}
                      onChange={v => setFiltro('centro_costo', v)}
                      getKey={c => c.codigo} getLabel={c => `${c.codigo} - ${c.descripcion}`} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-0">Doc. ref. contiene</label>
                    <input className="form-control form-control-sm" value={filtros.doc_ref}
                      onChange={e => setFiltro('doc_ref', e.target.value)} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-0">Doc. soporte contiene</label>
                    <input className="form-control form-control-sm" value={filtros.doc_soporte}
                      onChange={e => setFiltro('doc_soporte', e.target.value)} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-0">Valor contiene</label>
                    <input className="form-control form-control-sm" value={filtros.valor}
                      onChange={e => setFiltro('valor', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-0">Base contiene</label>
                    <input className="form-control form-control-sm" value={filtros.base}
                      onChange={e => setFiltro('base', e.target.value)} />
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label small mb-0">Observación contiene</label>
                    <input className="form-control form-control-sm" value={filtros.observacion}
                      onChange={e => setFiltro('observacion', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small mb-0">Comentarios contiene</label>
                    <input className="form-control form-control-sm" value={filtros.comentarios}
                      onChange={e => setFiltro('comentarios', e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <div className="mt-3">
              <button className="btn btn-success btn-sm" onClick={buscar} disabled={cargando}>
                {cargando
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Buscando...</>
                  : <><i className="bi bi-search me-2"></i>Buscar</>}
              </button>
            </div>
          </div>
        </div>

        {/* Paso 3: vista previa */}
        {preview && (
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="text-muted small fw-semibold mb-2">3. Confirme el grupo de registros</div>

              {preview.total === 0 ? (
                <div className="alert alert-secondary mb-0">
                  <i className="bi bi-info-circle me-2"></i>Ningún registro coincide con los filtros.
                </div>
              ) : (
                <>
                  <div className="d-flex align-items-center gap-3 mb-2">
                    <span className="badge bg-primary fs-6">{preview.total} registro(s)</span>
                    {preview.total > preview.muestra.length && (
                      <span className="text-muted small">
                        Mostrando los primeros {preview.muestra.length}.
                      </span>
                    )}
                  </div>
                  <div className="table-responsive mb-3" style={{ maxHeight: 320, overflow: 'auto' }}>
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light sticky-top">
                        <tr>
                          {preview.columnas.map(c => <th key={c.key} className="small text-nowrap">{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.muestra.map((fila, i) => (
                          <tr key={i}>
                            {preview.columnas.map(c => (
                              <td key={c.key} className="small text-nowrap" style={{ maxWidth: 220 }}>
                                <span className="d-inline-block text-truncate" style={{ maxWidth: 210 }}>
                                  {cellValor(c, fila)}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="acuse"
                      checked={acuse} onChange={e => setAcuse(e.target.checked)} />
                    <label className="form-check-label fw-semibold" htmlFor="acuse">
                      Confirmo que quiero modificar estos <strong>{preview.total}</strong> registro(s).
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Paso 4: cambio */}
        {preview && preview.total > 0 && acuse && (
          <div className="card border-0 shadow-sm mb-3 border-start border-4 border-warning">
            <div className="card-body">
              <div className="text-muted small fw-semibold mb-3">4. Elija el campo y el nuevo valor</div>
              <div className="row g-2">
                <div className="col-md-5">
                  <label className="form-label small mb-0">Campo a modificar</label>
                  <select className="form-select form-select-sm" value={campo}
                    onChange={e => { setCampo(e.target.value); setValor(''); }}>
                    <option value="">— Seleccione —</option>
                    {preview.campos_editables.map(c => (
                      <option key={c.campo} value={c.campo}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-7">
                  <label className="form-label small mb-0">Nuevo valor</label>
                  {!campoDef && <input className="form-control form-control-sm" disabled placeholder="Elija un campo" />}

                  {campoDef?.tipo === 'texto' && (
                    <input className="form-control form-control-sm" value={valor}
                      maxLength={campoDef.max} onChange={e => setValor(e.target.value)} />
                  )}
                  {campoDef?.tipo === 'numero' && (
                    <input type="number" step="0.01" className="form-control form-control-sm" value={valor}
                      onChange={e => setValor(e.target.value)} />
                  )}
                  {campoDef?.tipo === 'fecha' && (
                    <input type="date" className="form-control form-control-sm" value={valor}
                      onChange={e => setValor(e.target.value)} />
                  )}
                  {campoDef?.tipo === 'select_tipo_mov' && (
                    <select className="form-select form-select-sm" value={valor}
                      onChange={e => setValor(e.target.value)}>
                      <option value="">— Seleccione —</option>
                      <option value="D">D (débito)</option>
                      <option value="C">C (crédito)</option>
                    </select>
                  )}
                  {campoDef?.tipo === 'select_cuenta' && (
                    <select className="form-select form-select-sm" value={valor}
                      onChange={e => setValor(e.target.value)}>
                      <option value="">— Seleccione —</option>
                      {opciones.cuentas.filter(c => c.es_detalle && c.is_active).map(c => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.descripcion}</option>
                      ))}
                    </select>
                  )}
                  {campoDef?.tipo === 'select_centro' && (
                    <select className="form-select form-select-sm" value={valor}
                      onChange={e => setValor(e.target.value)}>
                      <option value="">— Seleccione —</option>
                      {opciones.centros.map(c => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.descripcion}</option>
                      ))}
                    </select>
                  )}
                  {campoDef?.tipo === 'select_comprobante' && (
                    <select className="form-select form-select-sm" value={valor}
                      onChange={e => setValor(e.target.value)}>
                      <option value="">— Seleccione —</option>
                      {opciones.comprobantes.map(c => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.descripcion}</option>
                      ))}
                    </select>
                  )}
                  {campoDef?.tipo === 'select_cedula' && (
                    <>
                      <input className="form-control form-control-sm" list="cedulas-datalist" value={valor}
                        onChange={e => setValor(e.target.value)} placeholder="Cédula" />
                      <datalist id="cedulas-datalist">
                        {opciones.terceros.map(t => (
                          <option key={t.cedula} value={t.cedula}>{t.nombre_completo}</option>
                        ))}
                      </datalist>
                    </>
                  )}
                </div>
              </div>

              <hr />
              <div className="row g-2 align-items-end">
                <div className="col-md-5">
                  <label className="form-label small mb-0">
                    Para confirmar, escriba <code>CONFIRMAR</code>
                  </label>
                  <input className="form-control form-control-sm" value={confirmText}
                    onChange={e => setConfirmText(e.target.value)} placeholder="CONFIRMAR" />
                </div>
                <div className="col-md-7">
                  <button className="btn btn-danger btn-sm" onClick={aplicar} disabled={!puedeAplicar}>
                    {aplicando
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Aplicando...</>
                      : <><i className="bi bi-check2-circle me-2"></i>Aplicar a {preview.total} registro(s)</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Borrado Duro */}
      {bd.open && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-danger">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <i className="bi bi-trash-fill me-2"></i>Borrado Duro
                </h5>
                <button type="button" className="btn-close btn-close-white"
                  onClick={() => setBd({ open: false, loading: false, preview: null, confirm: '', ejecutando: false, result: null })}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-danger border-0 mb-3">
                  <i className="bi bi-exclamation-octagon me-2"></i>
                  <strong>Acción irreversible.</strong> Se eliminarán físicamente de la base de datos
                  los registros que tienen borrado suave (eliminados) en todas las tablas
                  (movicont, plantillas, terceros, centros de costo, comprobantes, etc.).
                </div>

                {bd.loading ? (
                  <div className="text-center py-3">
                    <span className="spinner-border spinner-border-sm me-2"></span>Consultando...
                  </div>
                ) : bd.result ? (
                  <div className="mb-2">
                    <div className="row g-2 mb-3">
                      <div className="col-md-6">
                        <div className="border rounded p-3 text-center bg-success-subtle">
                          <div className="fs-3 fw-bold text-success">{bd.result.total_eliminados}</div>
                          <div className="small text-muted">Registros eliminados definitivamente</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="border rounded p-3 text-center bg-warning-subtle">
                          <div className="fs-3 fw-bold text-warning">{bd.result.total_protegidos}</div>
                          <div className="small text-muted">Registros protegidos (en uso)</div>
                        </div>
                      </div>
                    </div>
                    <div className="table-responsive" style={{ maxHeight: 240, overflow: 'auto' }}>
                      <table className="table table-sm table-hover align-middle mb-0">
                        <thead className="table-light sticky-top">
                          <tr>
                            <th>Tabla</th>
                            <th className="text-center">Eliminados</th>
                            <th className="text-center">Protegidos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bd.result.por_tabla.map(f => (
                            <tr key={f.tabla}>
                              <td className="small fw-semibold">{f.tabla}</td>
                              <td className="text-center small">{f.eliminados}</td>
                              <td className="text-center small">{f.protegidos}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <>
                    {!bd.preview || bd.preview.total === 0 ? (
                      <div className="alert alert-secondary mb-0">
                        <i className="bi bi-info-circle me-2"></i>
                        No hay registros con borrado suave. Nada que borrar.
                      </div>
                    ) : (
                      <>
                        <div className="mb-3">
                          <span className="badge bg-danger fs-6">{bd.preview.total} registro(s) con borrado suave</span>
                        </div>
                        <div className="table-responsive mb-3" style={{ maxHeight: 240, overflow: 'auto' }}>
                          <table className="table table-sm table-hover align-middle mb-0">
                            <thead className="table-light sticky-top">
                              <tr>
                                <th>Tabla</th>
                                <th className="text-center">Registros</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bd.preview.por_tabla.map(t => (
                                <tr key={t.tabla}>
                                  <td className="small fw-semibold">{t.tabla}</td>
                                  <td className="text-center small">{t.cantidad}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="row g-2 align-items-end">
                          <div className="col-md-7">
                            <label className="form-label small mb-0">
                              Para ejecutar, escriba <code className="text-danger">BORRAR</code>
                            </label>
                            <input className="form-control form-control-sm" value={bd.confirm}
                              onChange={e => setBd(b => ({ ...b, confirm: e.target.value }))}
                              placeholder="BORRAR" disabled={bd.ejecutando}
                              onKeyDown={e => { if (e.key === 'Enter') ejecutarBd(); }} />
                          </div>
                          <div className="col-md-5">
                            <button className="btn btn-danger w-100"
                              disabled={bd.ejecutando || bd.confirm.trim().toUpperCase() !== 'BORRAR'}
                              onClick={ejecutarBd}>
                              {bd.ejecutando
                                ? <><span className="spinner-border spinner-border-sm me-2"></span>Borrando...</>
                                : <><i className="bi bi-trash-fill me-2"></i>Ejecutar borrado duro</>}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary"
                  onClick={() => setBd({ open: false, loading: false, preview: null, confirm: '', ejecutando: false, result: null })}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
