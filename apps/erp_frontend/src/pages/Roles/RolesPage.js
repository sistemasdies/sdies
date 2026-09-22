import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import MultiSelect from '../../components/common/MultiSelect';
import API from '../../api/client';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';
import { getCentrosCosto } from '../../api/centrosCosto';
import { getCuentas } from '../../api/cuentas';
import { getComprobantes } from '../../api/comprobantes';

const getRoles       = ()            => API.get('/users/roles/');
const crearRol       = (data)        => API.post('/users/roles/', data);
const editarRol      = (id, data)    => API.put(`/users/roles/${id}/`, data);
const eliminarRol    = (id)          => API.delete(`/users/roles/${id}/`);
const getPermisos    = ()            => API.get('/users/permissions/');

const ACTIONS = ['acceder', 'listar', 'agregar', 'editar', 'borrar', 'anular'];
const ACTION_LABELS = { acceder: 'Acceder', listar: 'Listar', agregar: 'Agregar', editar: 'Editar', borrar: 'Borrar', anular: 'Anular' };
const ACTION_ICONS  = { acceder: 'bi-box-arrow-in-right', listar: 'bi-list-ul', agregar: 'bi-plus-circle', editar: 'bi-pencil', borrar: 'bi-trash', anular: 'bi-slash-circle' };

const MODULE_LABELS = {
  plan_cuentas:      'Plan de Cuentas',
  asientos:          'Asientos',
  asientos_plantilla:'Asientos con Plantillas',
  plantillas:        'Plantillas Contables',
  terceros:          'Terceros',
  centros_costo:     'Centros de Costo',
  comprobantes:      'Comprobantes',
  periodos:          'Períodos',
  reportes:          'Reportes',
  importar:          'Importar Datos',
  usuarios:          'Usuarios',
  roles:             'Roles',
};

const FORM_VACIO = {
  NameRole: '', description: '', permission_ids: [],
  centros_costo: [], cuentas: [], comprobantes: [], controles: {},
};

const CONTROLS_CATALOGO = [
  { code: 'editar_movimiento', label: 'Botón Editar Movimiento', desc: 'Ventana ver documento (Asientos Contables)' },
  { code: 'guardar_fecha',     label: 'Botón Guardar Fecha',     desc: 'Chulito ✓ de guardar fecha del documento' },
  { code: 'guardar_renglon',   label: 'Botón Guardar Renglón',   desc: 'Chulito ✓ de guardar cada renglón' },
  { code: 'guardar_todo',      label: 'Botón Guardar Todo',      desc: 'Chulito doble ✓ de guardar todos los renglones de un click' },
];

export default function RolesPage() {
  const { canAdd, canEdit, canDel } = usePerm('/roles');
  const [roles,     setRoles]     = useState([]);
  const [permisos,  setPermisos]  = useState({});
  const [catOpciones, setCatOpciones] = useState({ centros: [], cuentas: [], comprobantes: [] });
  const [tab,       setTab]       = useState('areas');
  const [loading,  setLoading]    = useState(true);
  const [modal,    setModal]      = useState(false);
  const [editando, setEditando]   = useState(null);
  const [form,     setForm]       = useState(FORM_VACIO);
  const [saving,   setSaving]     = useState(false);
  const [modalDel, setModalDel]   = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    getRoles()
      .then(r => setRoles(r.data.results || r.data))
      .catch(()=>{})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    getPermisos().then(r => {
      const data = r.data.results || r.data;
      const grouped = {};
      data.forEach(p => { grouped[p.module] = grouped[p.module] || []; grouped[p.module].push(p); });
      setPermisos(grouped);
    }).catch(()=>{});
    getCentrosCosto().then(r => setCatOpciones(o => ({ ...o, centros: r.data.results || r.data }))).catch(()=>{});
    getCuentas({ page_size: 10000 }).then(r => setCatOpciones(o => ({ ...o, cuentas: r.data.results || r.data }))).catch(()=>{});
    getComprobantes().then(r => setCatOpciones(o => ({ ...o, comprobantes: r.data.results || r.data }))).catch(()=>{});
  }, []);

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setTab('areas'); setModal(true); };

  const abrirEditar = (r) => {
    setEditando(r);
    setForm({
      NameRole:      r.NameRole,
      description:   r.description,
      permission_ids: r.permissions.map(p => p.id),
      centros_costo: r.centros_costo || [],
      cuentas:       r.cuentas || [],
      comprobantes:  r.comprobantes || [],
      controles:     r.controles || {},
    });
    setTab('areas');
    setModal(true);
  };

  const togglePerm = (id) => {
    setForm(f => ({
      ...f,
      permission_ids: f.permission_ids.includes(id)
        ? f.permission_ids.filter(x => x !== id)
        : [...f.permission_ids, id],
    }));
  };

  const toggleModule = (module) => {
    const modPerms = (permisos[module] || []).map(p => p.id);
    const allSelected = modPerms.every(id => form.permission_ids.includes(id));
    setForm(f => ({
      ...f,
      permission_ids: allSelected
        ? f.permission_ids.filter(id => !modPerms.includes(id))
        : [...new Set([...f.permission_ids, ...modPerms])],
    }));
  };

  const toggleAction = (action) => {
    const actionPerms = Object.values(permisos).flat().filter(p => p.code.endsWith(`.${action}`)).map(p => p.id);
    const allSelected = actionPerms.every(id => form.permission_ids.includes(id));
    setForm(f => ({
      ...f,
      permission_ids: allSelected
        ? f.permission_ids.filter(id => !actionPerms.includes(id))
        : [...new Set([...f.permission_ids, ...actionPerms])],
    }));
  };

  const setControl = (code) => (valor) => {
    setForm(f => ({ ...f, controles: { ...f.controles, [code]: valor } }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        NameRole:      form.NameRole.trim(),
        description:   form.description.trim(),
        permission_ids: form.permission_ids,
        centros_costo_ids: form.centros_costo,
        cuentas_ids:   form.cuentas,
        comprobantes_ids: form.comprobantes,
        controles:     form.controles,
      };
      if (editando) {
        await editarRol(editando.id, payload);
        toast.success('Rol actualizado');
      } else {
        await crearRol(payload);
        toast.success('Rol creado');
      }
      setModal(false);
      cargar();
    } catch (err) {
      const d = err.response?.data;
      if (d?.NameRole) toast.error(`Nombre "${form.NameRole}" ya existe`);
      else if (typeof d?.detail === 'string') toast.error(d.detail);
      else toast.error('Error al guardar');
    } finally { setSaving(false); }
  };

  const handleEliminar = async () => {
    try {
      await eliminarRol(modalDel.id);
      toast.success(`Rol "${modalDel.NameRole}" eliminado`);
      setModalDel(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se puede eliminar');
    }
  };

  const getModCount = (r) => {
    const modules = new Set(r.permissions.map(p => p.module));
    return modules.size;
  };

  return (
    <MainLayout>
      <TopBar title="Roles" />
      <div className="p-4">
        <PageHeader title="Gestión de Roles y Permisos"
          subtitle={`${roles.length} rol(es) definido(s)`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-shield-plus me-1"></i>Nuevo rol
          </button>
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          {loading ? <div className="card-body"><Spinner /></div>
            : <div className="table-responsive">
                <table className="table table-hover table-sm mb-0 align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>Rol</th>
                      <th>Descripción</th>
                      <th className="text-center">Módulos</th>
                      <th className="text-center">Permisos</th>
                      <th className="text-center">Usuarios</th>
                      <th className="text-center">Tipo</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.length === 0
                      ? <tr><td colSpan={7} className="text-center text-muted py-4">Sin registros</td></tr>
                      : roles.map(r => (
                        <tr key={r.id}>
                          <td>
                            <span className="fw-bold">
                              <i className="bi bi-shield-fill me-1 text-success"></i>
                              {r.NameRole}
                            </span>
                          </td>
                          <td className="text-muted small">{r.description || '—'}</td>
                          <td className="text-center">
                            <span className="badge bg-info text-dark">{getModCount(r)}</span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-primary">{r.permissions.length}</span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-secondary">{r.users_count}</span>
                          </td>
                          <td className="text-center">
                            {r.is_system
                              ? <span className="badge bg-warning text-dark">Sistema</span>
                              : <span className="badge bg-light text-dark border">Personalizado</span>}
                          </td>
                          <td className="text-center">
                            <div className="btn-group btn-group-sm">
                              <button className="btn btn-outline-primary"
                                onClick={() => abrirEditar(r)} title="Editar" disabled={!canEdit}>
                                <i className="bi bi-pencil"></i>
                              </button>
                              {!r.is_system && (
                                <button className="btn btn-outline-danger"
                                  onClick={() => setModalDel(r)} title="Eliminar" disabled={!canDel}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg modal-dialog-centered" style={{maxWidth:700}}>
            <div className="modal-content shadow d-flex" style={{maxHeight:'85vh'}}>
              <div className="modal-header bg-success text-white flex-shrink-0">
                <h5 className="modal-title">
                  <i className="bi bi-shield me-2"></i>
                  {editando ? `Editar — ${editando.NameRole}` : 'Nuevo rol'}
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setModal(false)}></button>
              </div>
              <form onSubmit={guardar} autoComplete="off" className="d-flex flex-column" style={{minHeight:0}}>
                <div className="modal-body" style={{overflowY:'auto', minHeight:0}}>
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        Nombre <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" maxLength={10} required
                        value={form.NameRole} placeholder="Ej: Contador"
                        onChange={e => setForm({ ...form, NameRole: e.target.value })} />
                      <div className="form-text">Máx. 10 caracteres</div>
                    </div>
                    <div className="col-md-8">
                      <label className="form-label small fw-semibold">Descripción</label>
                      <input className="form-control"
                        value={form.description} placeholder="Descripción del rol"
                        onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                  </div>

                  {/* Pestañas */}
                  <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                      <button type="button" className={`nav-link ${tab === 'areas' ? 'active' : ''}`}
                        onClick={() => setTab('areas')}>
                        <i className="bi bi-key me-1"></i>Áreas permitidas
                      </button>
                    </li>
                    <li className="nav-item">
                      <button type="button" className={`nav-link ${tab === 'datos' ? 'active' : ''}`}
                        onClick={() => setTab('datos')}>
                        <i className="bi bi-database me-1"></i>Datos permitidos
                      </button>
                    </li>
                    <li className="nav-item">
                      <button type="button" className={`nav-link ${tab === 'controles' ? 'active' : ''}`}
                        onClick={() => setTab('controles')}>
                        <i className="bi bi-toggle2-on me-1"></i>Controles
                      </button>
                    </li>
                  </ul>

                  {tab === 'areas' && (
                  <>
                  {/* Acciones globales */}
                  <div className="d-flex gap-2 mb-2 flex-wrap">
                    {ACTIONS.map(a => {
                      const actionPerms = Object.values(permisos).flat().filter(p => p.code.endsWith(`.${a}`));
                      const allSel = actionPerms.length > 0 && actionPerms.every(p => form.permission_ids.includes(p.id));
                      return (
                        <button key={a} type="button"
                          className={`btn btn-sm ${allSel ? 'btn-success' : 'btn-outline-secondary'}`}
                          onClick={() => toggleAction(a)}>
                          <i className={`bi ${ACTION_ICONS[a]} me-1`}></i>
                          {ACTION_LABELS[a]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Matriz módulos × acciones */}
                  <div className="table-responsive" style={{maxHeight:'35vh', overflowY:'auto'}}>
                    <table className="table table-bordered table-sm mb-0 align-middle">
                      <thead className="table-light" style={{position:'sticky', top:0, zIndex:1}}>
                        <tr>
                          <th style={{minWidth:150}}>
                            <div className="form-check">
                              <input type="checkbox" className="form-check-input"
                                id="allMod"
                                checked={Object.values(permisos).flat().every(p => form.permission_ids.includes(p.id))}
                                onChange={() => {
                                  const all = Object.values(permisos).flat().map(p => p.id);
                                  const allSel = all.every(id => form.permission_ids.includes(id));
                                  setForm(f => ({ ...f, permission_ids: allSel ? [] : all }));
                                }} />
                              <label className="form-check-label fw-bold" htmlFor="allMod">
                                Todos
                              </label>
                            </div>
                          </th>
                          {ACTIONS.map(a => (
                            <th key={a} className="text-center" style={{width:80}}>
                              {ACTION_LABELS[a]}
                            </th>
                          ))}
                          <th className="text-center" style={{width:70}}>Módulo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(permisos).map(([mod, perms]) => {
                          const modSel = perms.every(p => form.permission_ids.includes(p.id));
                          const modSome = perms.some(p => form.permission_ids.includes(p.id));
                          return (
                            <tr key={mod} className={modSome ? 'table-light' : ''}>
                              <td>
                                <div className="form-check">
                                  <input type="checkbox" className="form-check-input"
                                    id={`mod-${mod}`}
                                    checked={modSel}
                                    ref={el => { if (el) el.indeterminate = modSome && !modSel; }}
                                    onChange={() => toggleModule(mod)} />
                                  <label className="form-check-label fw-semibold" htmlFor={`mod-${mod}`}>
                                    <i className="bi bi-grid-3x3-gap me-1 text-success"></i>
                                    {MODULE_LABELS[mod] || mod}
                                  </label>
                                </div>
                              </td>
                              {ACTIONS.map(a => {
                                const perm = perms.find(p => p.code.endsWith(`.${a}`));
                                return (
                                  <td key={a} className="text-center">
                                    {perm && (
                                      <div className="form-check form-check-inline m-0">
                                        <input type="checkbox" className="form-check-input"
                                          id={`perm-${perm.id}`}
                                          checked={form.permission_ids.includes(perm.id)}
                                          onChange={() => togglePerm(perm.id)} />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="text-center">
                                <small className="text-muted font-monospace">{mod}</small>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="form-text mt-2">
                    <i className="bi bi-info-circle me-1"></i>
                    Seleccionados: <strong>{form.permission_ids.length}</strong> de{' '}
                    <strong>{Object.values(permisos).flat().length}</strong> permisos
                  </div>
                  </>
                  )}

                  {tab === 'datos' && (
                    <>
                      <div className="alert alert-light border small py-2 mb-3">
                        <i className="bi bi-info-circle me-1"></i>
                        Los datos <strong>no seleccionados</strong> no se tendrán en cuenta en
                        ningún informe ni operación de este rol. Vacío = acceso a todos.
                      </div>
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold">Centros de Costo</label>
                          <MultiSelect options={catOpciones.centros} value={form.centros_costo}
                            getKey={c => c.codigo} getLabel={c => `${c.codigo} — ${c.descripcion}`}
                            onChange={v => setForm(f => ({ ...f, centros_costo: v }))} />
                          <div className="form-text">{form.centros_costo.length === 0
                            ? 'Acceso a todos los centros de costo.'
                            : `${form.centros_costo.length} centro(s) permitido(s).`}</div>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold">Cuentas</label>
                          <MultiSelect options={catOpciones.cuentas} value={form.cuentas}
                            getKey={c => c.codigo} getLabel={c => `${c.codigo} — ${c.descripcion}`}
                            onChange={v => setForm(f => ({ ...f, cuentas: v }))} />
                          <div className="form-text">{form.cuentas.length === 0
                            ? 'Acceso a todas las cuentas.'
                            : `${form.cuentas.length} cuenta(s) · al elegir un nivel se incluyen sus hijas.`}</div>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold">Comprobantes</label>
                          <MultiSelect options={catOpciones.comprobantes} value={form.comprobantes}
                            getKey={c => c.codigo} getLabel={c => `${c.codigo} — ${c.descripcion || ''}`}
                            onChange={v => setForm(f => ({ ...f, comprobantes: v }))} />
                          <div className="form-text">{form.comprobantes.length === 0
                            ? 'Acceso a todos los comprobantes.'
                            : `${form.comprobantes.length} comprobante(s) permitido(s).`}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {tab === 'controles' && (
                    <>
                      <div className="alert alert-light border small py-2 mb-3">
                        <i className="bi bi-info-circle me-1"></i>
                        Cada control declara si el botón u opción de la interfaz está{' '}
                        <strong>Permitido</strong> o <strong>Denegado</strong> para este rol.
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm mb-0 align-middle">
                          <thead className="table-light">
                            <tr>
                              <th style={{minWidth:220}}>Control</th>
                              <th>Descripción</th>
                              <th className="text-center" style={{width:220}}>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {CONTROLS_CATALOGO.map(c => {
                              const estado = form.controles[c.code] || 'P';
                              return (
                                <tr key={c.code}>
                                  <td className="fw-semibold">{c.label}</td>
                                  <td><small className="text-muted">{c.desc}</small></td>
                                  <td className="text-center">
                                    <div className="btn-group btn-group-sm">
                                      <button type="button"
                                        className={`btn ${estado === 'P' ? 'btn-success' : 'btn-outline-success'}`}
                                        onClick={() => setControl(c.code)('P')}>
                                        <i className="bi bi-check-circle me-1"></i>Permitido
                                      </button>
                                      <button type="button"
                                        className={`btn ${estado === 'D' ? 'btn-danger' : 'btn-outline-danger'}`}
                                        onClick={() => setControl(c.code)('D')}>
                                        <i className="bi bi-x-circle me-1"></i>Denegado
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer flex-shrink-0">
                  <button type="button" className="btn btn-secondary"
                    onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving
                      ? <><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                      : <><i className="bi bi-check2 me-1"></i>Guardar</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {modalDel && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:420}}>
            <div className="modal-content shadow border-danger">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-octagon me-2"></i>Eliminar rol
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setModalDel(null)}></button>
              </div>
              <div className="modal-body">
                <p>¿Eliminar el rol <strong>{modalDel.NameRole}</strong>?</p>
                <p className="text-muted small mb-0">{modalDel.description}</p>
                <p className="small mt-2">
                  Permisos: <span className="badge bg-primary">{modalDel.permissions.length}</span>
                  &nbsp;· Usuarios: <span className="badge bg-secondary">{modalDel.users_count}</span>
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModalDel(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={handleEliminar}>
                  <i className="bi bi-trash-fill me-1"></i>Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
