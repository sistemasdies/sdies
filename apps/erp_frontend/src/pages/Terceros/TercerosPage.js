import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import { getTerceros, createTercero, updateTercero, deleteTercero, exportarTerceros, siguienteCedula } from '../../api/terceros';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const FORM_VACIO = {
  cedula:'', tipo_documento:'', tipo_persona:'N',
  nombre1:'', nombre2:'', apellido1:'', apellido2:'', razon_social:'',
  lugar_exp_cedula:'', fecha_nacimiento:'', lugar_nacimiento:'',
  sexo:'', direccion:'', barrio:'',
  municipio:'', departamento:'', distrito:'',
  telefono1:'', telefono2:'', celular:'', fax:'', email:'',
  comentarios:'',
};

const PAGE_SIZE = 50;

const COLUMNAS = [
  { key:'cedula',         label:'Identificación' },
  { key:'tipo_documento', label:'Doc' },
  { key:'apellido1',      label:'Nombre / Razón Social' },
  { key:'telefono1',      label:'Teléfono' },
  { key:'email',          label:'Email' },
  { key:'celular',        label:'Celular' },
];

export default function TercerosPage() {
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);
  const [terceros, setTerceros] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [total,    setTotal]    = useState(0);
  const [pagina,   setPagina]   = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [orden,    setOrden]    = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page: pagina, page_size: PAGE_SIZE, ...(busqueda && { search: busqueda }) };
    if (orden) params.ordering = (orden.dir === 'desc' ? '-' : '') + orden.campo;
    getTerceros(params).then(r => {
      setTerceros(r.data.results || r.data);
      setTotal(r.data.count || 0);
    }).catch(()=>{}).finally(() => setLoading(false));
  }, [pagina, busqueda, orden]);

  useEffect(() => { cargar(); }, [cargar]);

  const sortOn = (campo) => {
    setOrden(prev => {
      if (!prev || prev.campo !== campo) return { campo, dir: 'asc' };
      if (prev.dir === 'asc') return { campo, dir: 'desc' };
      return null;
    });
    setPagina(1);
  };

  const generarCodigo = async () => {
    try {
      const r = await siguienteCedula();
      setForm({...form, cedula: r.data.siguiente_cedula});
    } catch {
      toast.error('No se pudo generar el código');
    }
  };

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setModal(true); };

  const abrirEditar = (t) => {
    setEditando(t);
    setForm({
      cedula:            t.cedula            || '',
      tipo_documento:    t.tipo_documento    || '',
      tipo_persona:      t.tipo_persona      || 'N',
      nombre1:           t.nombre1           || '',
      nombre2:           t.nombre2           || '',
      apellido1:         t.apellido1         || '',
      apellido2:         t.apellido2         || '',
      razon_social:      t.razon_social      || '',
      lugar_exp_cedula:  t.lugar_exp_cedula  || '',
      fecha_nacimiento:  t.fecha_nacimiento  || '',
      lugar_nacimiento:  t.lugar_nacimiento  || '',
      sexo:              t.sexo              || '',
      direccion:         t.direccion         || '',
      barrio:            t.barrio            || '',
      municipio:         t.municipio         || '',
      departamento:      t.departamento      || '',
      distrito:          t.distrito          || '',
      telefono1:         t.telefono1         || '',
      telefono2:         t.telefono2         || '',
      celular:           t.celular           || '',
      fax:               t.fax               || '',
      email:             t.email             || '',
      comentarios:       t.comentarios       || '',
    });
    setModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    try {
      if (editando) { await updateTercero(editando.id, form); toast.success('Tercero actualizado'); }
      else          { await createTercero(form);               toast.success('Tercero creado');      }
      setModal(false); cargar();
    } catch (err) {
      toast.error(err.response?.data?.cedula?.[0] || 'Error al guardar');
    }
  };

  const eliminar = async (t) => {
    if (!window.confirm(`¿Eliminar a ${t.nombre_completo}?`)) return;
    try { await deleteTercero(t.id); toast.success('Tercero eliminado'); cargar(); }
    catch { toast.error('No se puede eliminar este tercero'); }
  };

  const exportar = async () => {
    try {
      const params = { ...(busqueda && { search: busqueda }) };
      const r = await exportarTerceros(params);
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'terceros.csv'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportación completada');
    } catch {
      toast.error('Error al exportar');
    }
  };

  const sf = (v) => form[v] !== undefined ? form[v] : '';

  return (
    <MainLayout>
      <TopBar title="Terceros" />
      <div className="p-4">
        <PageHeader title="Terceros" subtitle={`${total} registros`}>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={exportar}>
              <i className="bi bi-download me-1"></i>Exportar CSV
            </button>
            <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
              <i className="bi bi-person-plus me-1"></i>Nuevo tercero
            </button>
          </div>
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group" style={{maxWidth:400}}>
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input className="form-control" placeholder="Buscar por cédula, nombre o razón social..."
                value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1); }} />
              {busqueda && <button className="btn btn-outline-secondary" onClick={() => setBusqueda('')}><i className="bi bi-x"></i></button>}
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          {loading ? <div className="p-4"><Spinner /></div> : (
            <div className="table-responsive" style={{maxHeight:'65vh', overflowY:'auto'}}>
              <table className="table table-hover table-sm mb-0">
                <thead className="table-dark" style={{position:'sticky', top:0, zIndex:1}}>
                  <tr>
                    {COLUMNAS.map(c => (
                      <th key={c.key} onClick={() => sortOn(c.key)}
                        style={{cursor:'pointer', userSelect:'none', whiteSpace:'nowrap'}}>
                        {c.label}
                        {orden?.campo === c.key && (
                          <span className="ms-1">{orden.dir === 'asc' ? '\u25B2' : '\u25BC'}</span>
                        )}
                      </th>
                    ))}
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {terceros.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted py-4">Sin terceros</td></tr>
                  )}
                  {terceros.map(t => (
                    <tr key={t.id}>
                      <td><code className="small">{t.cedula}</code></td>
                      <td><span className="badge bg-secondary">{t.tipo_documento}</span></td>
                      <td className="small">{t.nombre_completo}</td>
                      <td className="small">{t.telefono1 || '—'}</td>
                      <td className="small">{t.email || '—'}</td>
                      <td className="small">{t.celular || '—'}</td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                           <button className="btn btn-outline-primary" onClick={() => abrirEditar(t)} disabled={!canEdit}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger" onClick={() => eliminar(t)} disabled={!canDel}>
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
          {Math.ceil(total/PAGE_SIZE) > 1 && (
            <div className="card-footer d-flex justify-content-between align-items-center">
              <span className="small text-muted">Página {pagina} de {Math.ceil(total/PAGE_SIZE)}</span>
              <div className="btn-group btn-group-sm">
                <button className="btn btn-outline-secondary" disabled={pagina===1} onClick={() => setPagina(p=>p-1)}><i className="bi bi-chevron-left"></i></button>
                <button className="btn btn-outline-secondary" disabled={pagina>=Math.ceil(total/PAGE_SIZE)} onClick={() => setPagina(p=>p+1)}><i className="bi bi-chevron-right"></i></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:1055}}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-person-badge me-2"></i>
                  {editando ? 'Editar tercero' : 'Nuevo tercero'}
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body" style={{maxHeight:'68vh',overflowY:'auto'}}>
                  {/* ── Grupo 1: Identificación ───────────────────────────── */}
                  <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
                    <i className="bi bi-shield-check me-2"></i>Identificación
                  </h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">
                        Cédula / NIT *
                        {!editando && (
                          <button type="button" className="btn btn-outline-success btn-sm ms-2" onClick={generarCodigo}>
                            <i className="bi bi-magic me-1"></i>Generar nuevo código
                          </button>
                        )}
                      </label>
                      <input className="form-control" value={sf('cedula')} required
                        disabled={!!editando}
                        onChange={e => setForm({...form, cedula: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold">Tipo documento</label>
                      <input className="form-control" value={sf('tipo_documento')}
                        onChange={e => setForm({...form, tipo_documento: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Lugar expedición</label>
                      <input className="form-control" value={sf('lugar_exp_cedula')}
                        onChange={e => setForm({...form, lugar_exp_cedula: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold">Tipo persona</label>
                      <select className="form-select" value={sf('tipo_persona')}
                        onChange={e => setForm({...form, tipo_persona: e.target.value})}>
                        <option value="N">Natural</option>
                        <option value="J">Jurídica</option>
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold">Sexo</label>
                      <select className="form-select" value={sf('sexo')}
                        onChange={e => setForm({...form, sexo: e.target.value})}>
                        <option value="">—</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Grupo 2: Nombres ──────────────────────────────────── */}
                  <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
                    <i className="bi bi-person me-2"></i>Nombres y Apellidos
                  </h6>
                  <div className="row g-3 mb-4">
                    {form.tipo_persona === 'N' ? <>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Primer nombre</label>
                        <input className="form-control" value={sf('nombre1')}
                          onChange={e => setForm({...form, nombre1: e.target.value})} />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Segundo nombre</label>
                        <input className="form-control" value={sf('nombre2')}
                          onChange={e => setForm({...form, nombre2: e.target.value})} />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Primer apellido</label>
                        <input className="form-control" value={sf('apellido1')}
                          onChange={e => setForm({...form, apellido1: e.target.value})} />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Segundo apellido</label>
                        <input className="form-control" value={sf('apellido2')}
                          onChange={e => setForm({...form, apellido2: e.target.value})} />
                      </div>
                    </> : (
                      <div className="col-12">
                        <label className="form-label small fw-semibold">Razón social *</label>
                        <input className="form-control" value={sf('razon_social')}
                          required={form.tipo_persona==='J'}
                          onChange={e => setForm({...form, razon_social: e.target.value})} />
                      </div>
                    )}
                  </div>

                  {/* ── Grupo 3: Contacto ─────────────────────────────────── */}
                  <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
                    <i className="bi bi-telephone me-2"></i>Contacto
                  </h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Dirección</label>
                      <input className="form-control" value={sf('direccion')}
                        onChange={e => setForm({...form, direccion: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold">Barrio</label>
                      <input className="form-control" value={sf('barrio')}
                        onChange={e => setForm({...form, barrio: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold">Teléfono 1</label>
                      <input className="form-control" value={sf('telefono1')}
                        onChange={e => setForm({...form, telefono1: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold">Teléfono 2</label>
                      <input className="form-control" value={sf('telefono2')}
                        onChange={e => setForm({...form, telefono2: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold">Celular</label>
                      <input className="form-control" value={sf('celular')}
                        onChange={e => setForm({...form, celular: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Email</label>
                      <input type="email" className="form-control" value={sf('email')}
                        onChange={e => setForm({...form, email: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Fax</label>
                      <input className="form-control" value={sf('fax')}
                        onChange={e => setForm({...form, fax: e.target.value})} />
                    </div>
                  </div>

                  {/* ── Grupo 4: Ubicación ────────────────────────────────── */}
                  <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
                    <i className="bi bi-geo-alt me-2"></i>Ubicación
                  </h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Departamento (código)</label>
                      <input className="form-control font-monospace" maxLength={2}
                        value={sf('departamento')} placeholder="Ej: 05"
                        onChange={e => setForm({...form, departamento: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Municipio (código)</label>
                      <input className="form-control font-monospace" maxLength={3}
                        value={sf('municipio')} placeholder="Ej: 001"
                        onChange={e => setForm({...form, municipio: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Distrito (código)</label>
                      <input className="form-control font-monospace" maxLength={2}
                        value={sf('distrito')} placeholder="Ej: 01"
                        onChange={e => setForm({...form, distrito: e.target.value})} />
                    </div>
                  </div>

                  {/* ── Grupo 5: Datos complementarios ────────────────────── */}
                  <h6 className="fw-bold text-success border-bottom pb-2 mb-3">
                    <i className="bi bi-card-list me-2"></i>Datos complementarios
                  </h6>
                  <div className="row g-3 mb-2">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Fecha de nacimiento</label>
                      <input type="date" className="form-control" value={sf('fecha_nacimiento')}
                        onChange={e => setForm({...form, fecha_nacimiento: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Lugar de nacimiento</label>
                      <input className="form-control" value={sf('lugar_nacimiento')}
                        onChange={e => setForm({...form, lugar_nacimiento: e.target.value})} />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Comentarios</label>
                      <textarea className="form-control" rows="2" value={sf('comentarios')}
                        onChange={e => setForm({...form, comentarios: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={editando ? !canEdit : !canAdd}><i className="bi bi-check2 me-1"></i>Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}