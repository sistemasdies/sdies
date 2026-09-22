import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import API from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { usePerm } from '../../hooks/usePerm';

const getUsuarios   = ()        => API.get('/users/');
const getRoles      = ()        => API.get('/users/roles/');
const crearUsuario  = (data)    => API.post('/users/', data);
const editarUsuario = (id,data) => API.put(`/users/${id}/`, data);
const desactivar    = (id)      => API.delete(`/users/${id}/`);
const activar       = (id)      => API.post(`/users/${id}/activar/`);
const eliminarDef   = (id)      => API.delete(`/users/${id}/eliminar-definitivo/`);
const resetPassword = (id,pwd)  => API.post(`/users/${id}/reset-password/`, {password:pwd});

const FORM_VACIO = { login:'', email:'', NameUser:'', caja_user:'', fecha_nacimiento:'', frase_verificacion:'', password:'', is_staff:false, is_active:true, role:null };

export default function UsuariosPage() {
  const { canAdd, canEdit, canDel } = usePerm('/usuarios');
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles,     setRoles]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modal,    setModal]    = useState(false);
  const [modalPwd, setModalPwd] = useState(null);
  const [form,     setForm]     = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [nuevaPwd, setNuevaPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showInac,    setShowInac]    = useState(false);
  const [modalElimDef,setModalElimDef]= useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    getUsuarios()
      .then(r => setUsuarios(r.data.results || r.data))
      .catch(()=>{})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { getRoles().then(r => setRoles(r.data.results || r.data)).catch(()=>{}); }, []);

  const activos   = usuarios.filter(u => u.is_active);
  const inactivos = usuarios.filter(u => !u.is_active);

  const filtrar = (lista) => lista.filter(u =>
    !busqueda ||
    u.login?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.NameUser?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setModal(true); };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({ login:u.login, email:u.email, NameUser:u.NameUser,
              caja_user:u.caja_user||'', fecha_nacimiento:u.fecha_nacimiento||'',
              frase_verificacion:u.frase_verificacion||'',
              password:'', is_staff:u.is_staff, is_active:u.is_active, role:u.role||null });
    setModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        login:     form.login.trim(),
        email:     form.email.trim(),
        NameUser:    form.NameUser.trim(),
        caja_user: form.caja_user.trim(),
        fecha_nacimiento: form.fecha_nacimiento || null,
        frase_verificacion: form.frase_verificacion.trim(),
        is_staff:  form.is_staff,
        is_active: form.is_active,
        role:      form.role || null,
      };
      if (!editando) payload.password = form.password;
      if (editando) {
        await editarUsuario(editando.id, payload);
        toast.success('Usuario actualizado');
      } else {
        await crearUsuario(payload);
        toast.success('Usuario creado');
      }
      setModal(false);
      cargar();
    } catch (err) {
      const d = err.response?.data?.detail || err.response?.data;
      if (d?.login)                    toast.error(`Login "${form.login}" ya existe`);
      else if (d?.email)               toast.error(`Email "${form.email}" ya está registrado`);
      else if (typeof d === 'string')  toast.error(d);
      else                             toast.error('Error al guardar — verifique los datos');
    } finally { setSaving(false); }
  };

  const handleDesactivar = async (u) => {
    if (!window.confirm(`¿Desactivar al usuario ${u.login}?`)) return;
    try {
      await desactivar(u.id);
      toast.success(`Usuario ${u.login} desactivado`);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al desactivar');
    }
  };

  const handleActivar = async (u) => {
    try {
      await activar(u.id);
      toast.success(`Usuario ${u.login} activado`);
      cargar();
    } catch { toast.error('Error al activar'); }
  };

  const handleEliminarDef = async () => {
    try {
      await eliminarDef(modalElimDef.id);
      toast.success(`Usuario ${modalElimDef.login} eliminado definitivamente`);
      setModalElimDef(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se puede eliminar');
    }
  };

  const handleResetPwd = async () => {
    if (nuevaPwd.length < 8) { toast.error('Mínimo 8 caracteres'); return; }
    try {
      await resetPassword(modalPwd.id, nuevaPwd);
      toast.success(`Contraseña de ${modalPwd.login} actualizada`);
      setModalPwd(null); setNuevaPwd('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar contraseña');
    }
  };

  const TablaUsuarios = ({ lista }) => (
    <div className="table-responsive">
      <table className="table table-hover table-sm mb-0 align-middle">
        <thead className="table-dark">
          <tr>
            <th>Login</th><th>Nombre</th><th>Email</th>
            <th>Rol</th>
            <th className="text-center">Caja</th>
            <th className="text-center">Admin</th>
            <th className="text-center">Estado</th>
            <th className="text-center">Verificación</th>
            <th className="text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0
            ? <tr><td colSpan={9} className="text-center text-muted py-4">Sin registros</td></tr>
            : lista.map(u => (
              <tr key={u.id} className={!u.is_active?'table-secondary':''}>
                <td><code className="fw-bold">{u.login}</code></td>
                <td className="fw-semibold">{u.NameUser}</td>
                <td className="small text-muted">{u.email}</td>
                <td className="small">{u.role_nombre || <span className="text-muted">—</span>}</td>
                <td className="text-center">
                  {u.caja_user
                    ? <span className="badge bg-info text-dark">{u.caja_user}</span>
                    : <span className="text-muted">—</span>}
                </td>
                <td className="text-center">
                  {u.is_staff
                    ? <span className="badge bg-danger">Admin</span>
                    : <span className="badge bg-secondary">Usuario</span>}
                </td>
                <td className="text-center">
                  {u.is_active
                    ? <span className="badge bg-success">Activo</span>
                    : <span className="badge bg-secondary">Inactivo</span>}
                </td>
                <td className="text-center">
                  {u.verificacion_pendiente
                    ? <span className="badge bg-warning text-dark" title="Sin frase/fecha de verificación">Pendiente</span>
                    : <span className="badge bg-success">Ok</span>}
                </td>
                <td className="text-center">
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-primary"
                      onClick={() => abrirEditar(u)} title="Editar" disabled={!canEdit}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className="btn btn-outline-warning"
                      onClick={() => { setModalPwd(u); setNuevaPwd(''); }}
                      title="Cambiar contraseña" disabled={!canEdit}>
                      <i className="bi bi-key"></i>
                    </button>
                    {u.is_active
                      ? <button className="btn btn-outline-danger"
                          onClick={() => handleDesactivar(u)} title="Desactivar"
                          disabled={!canDel || String(u.id) === String(currentUser?.id)}>
                          <i className="bi bi-person-dash"></i>
                        </button>
                      : <button className="btn btn-outline-success"
                          onClick={() => handleActivar(u)} title="Activar" disabled={!canDel}>
                          <i className="bi bi-person-check"></i>
                        </button>}
                    <button className="btn btn-danger"
                      onClick={() => setModalElimDef(u)}
                      title="Eliminar definitivamente"
                      disabled={!canDel || String(u.id) === String(currentUser?.id)}>
                      <i className="bi bi-trash-fill"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <MainLayout>
      <TopBar title="Usuarios" />
      <div className="p-4">
        <PageHeader title="Gestión de Usuarios"
          subtitle={`${activos.length} activo(s) · ${inactivos.length} inactivo(s)`}>
          <button className="btn btn-success" onClick={abrirNuevo} disabled={!canAdd}>
            <i className="bi bi-person-plus me-1"></i>Nuevo usuario
          </button>
        </PageHeader>

        {/* Buscador */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="d-flex gap-3 align-items-center">
              <div className="input-group" style={{maxWidth:360}}>
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input className="form-control" placeholder="Buscar login, nombre o email..."
                  value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
                {busqueda && (
                  <button className="btn btn-outline-secondary" onClick={()=>setBusqueda('')}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
              {inactivos.length > 0 && (
                <button className={`btn btn-sm ${showInac?'btn-secondary':'btn-outline-secondary'}`}
                  onClick={()=>setShowInac(p=>!p)}>
                  <i className="bi bi-person-slash me-1"></i>
                  {showInac?'Ocultar':'Ver'} inactivos ({inactivos.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Activos */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white fw-semibold">
            <i className="bi bi-people me-2 text-success"></i>
            Usuarios activos ({filtrar(activos).length})
          </div>
          {loading ? <div className="card-body"><Spinner /></div>
                   : <TablaUsuarios lista={filtrar(activos)} />}
        </div>

        {/* Inactivos */}
        {showInac && inactivos.length > 0 && (
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-secondary text-white fw-semibold">
              <i className="bi bi-person-slash me-2"></i>
              Usuarios inactivos ({filtrar(inactivos).length})
            </div>
            <TablaUsuarios lista={filtrar(inactivos)} />
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:480}}>
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-person me-2"></i>
                  {editando ? `Editar — ${editando.login}` : 'Nuevo usuario'}
                </h5>
                <button className="btn-close btn-close-white" onClick={()=>setModal(false)}></button>
              </div>
              <form onSubmit={guardar} autoComplete="off">
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Login <span className="text-danger">*</span></label>
                      <input className="form-control font-monospace"
                        maxLength={10} value={form.login} required
                        disabled={!!editando} autoComplete="off"
                        placeholder="Ej: jperez"
                        onChange={e=>setForm({...form,login:e.target.value})}/>
                      <div className="form-text">Máx. 10 caracteres</div>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Caja user</label>
                      <input className="form-control font-monospace"
                        maxLength={10} value={form.caja_user}
                        autoComplete="off" placeholder="Código de caja"
                        onChange={e=>setForm({...form,caja_user:e.target.value})}/>
                      <div className="form-text">Máx. 10 caracteres</div>
                    </div>
                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input type="checkbox" className="form-check-input"
                          id="isStaff" checked={form.is_staff}
                          onChange={e=>setForm({...form,is_staff:e.target.checked})}/>
                        <label className="form-check-label small fw-semibold" htmlFor="isStaff">
                          Administrador
                        </label>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input type="checkbox" className="form-check-input"
                          id="isActive" checked={form.is_active}
                          disabled={editando && String(editando.id) === String(currentUser?.id)}
                          onChange={e=>setForm({...form,is_active:e.target.checked})}/>
                        <label className="form-check-label small fw-semibold" htmlFor="isActive">
                          Activo
                          {editando && String(editando.id) === String(currentUser?.id) && (
                            <span className="text-muted ms-1">(no puedes desactivarte)</span>
                          )}
                        </label>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Rol</label>
                      <select className="form-select" value={form.role || ''}
                        onChange={e=>setForm({...form, role: e.target.value ? Number(e.target.value) : null})}>
                        <option value="">Sin rol</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.NameRole} — {r.description}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Nombre completo <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" maxLength={30}
                        value={form.NameUser} required autoComplete="off"
                        placeholder="Nombre y apellido"
                        onChange={e=>setForm({...form,NameUser:e.target.value})}/>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input type="email" className="form-control"
                        value={form.email} required autoComplete="off"
                        placeholder="correo@dominio.com"
                        onChange={e=>setForm({...form,email:e.target.value})}/>
                    </div>
                    {!editando && (
                      <div className="col-12">
                        <label className="form-label small fw-semibold">
                          Contraseña <span className="text-danger">*</span>
                        </label>
                        <input type="password" className="form-control"
                          value={form.password} required minLength={8}
                          autoComplete="new-password"
                          placeholder="Mínimo 8 caracteres"
                          onChange={e=>setForm({...form,password:e.target.value})}/>
                      </div>
                    )}
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Fecha de nacimiento</label>
                      <input type="date" className="form-control"
                        value={form.fecha_nacimiento || ''}
                        onChange={e=>setForm({...form,fecha_nacimiento:e.target.value})}/>
                      <small className="text-muted">Se usa en la recuperación de contraseña</small>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Frase de verificación</label>
                      <input type="password" className="form-control" maxLength={30}
                        value={form.frase_verificacion}
                        placeholder="Máximo 30 caracteres"
                        onChange={e=>setForm({...form,frase_verificacion:e.target.value})}/>
                      <small className="text-muted">Se elige un señuelo de esta frase al recuperar la contraseña</small>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary"
                    onClick={()=>setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={(editando ? !canEdit : !canAdd) || saving}>
                    {saving
                      ?<><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                      :<><i className="bi bi-check2 me-1"></i>Guardar</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal cambiar contraseña */}
      {modalPwd && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:400}}>
            <div className="modal-content shadow">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title">
                  <i className="bi bi-key me-2"></i>
                  Cambiar contraseña — {modalPwd.login}
                </h5>
                <button className="btn-close" onClick={()=>setModalPwd(null)}></button>
              </div>
              <div className="modal-body">
                <label className="form-label small fw-semibold">Nueva contraseña</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock"></i></span>
                  <input type={showNewPwd ? 'text' : 'password'} className="form-control"
                    value={nuevaPwd} minLength={8} autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    onChange={e=>setNuevaPwd(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&handleResetPwd()}/>
                  <button type="button" className="input-group-text"
                    onClick={()=>setShowNewPwd(!showNewPwd)} tabIndex={-1}>
                    <i className={`bi ${showNewPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                <div className="form-text">Mínimo 8 caracteres</div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary"
                  onClick={()=>setModalPwd(null)}>Cancelar</button>
                <button className="btn btn-warning text-dark" onClick={handleResetPwd}>
                  <i className="bi bi-key me-1"></i>Cambiar contraseña
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal eliminar definitivamente */}
      {modalElimDef && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.7)'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:440}}>
            <div className="modal-content shadow border-danger">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-octagon me-2"></i>
                  Eliminar definitivamente
                </h5>
                <button className="btn-close btn-close-white"
                  onClick={()=>setModalElimDef(null)}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-danger border-0 mb-3">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  <strong>Esta acción es irreversible.</strong> El usuario será eliminado
                  físicamente de la base de datos.
                </div>
                <p className="mb-2">¿Eliminar definitivamente:</p>
                <div className="bg-light rounded p-3">
                  <code className="fw-bold">{modalElimDef.login}</code> — {modalElimDef.NameUser}
                  <div className="small text-muted">{modalElimDef.email}</div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary"
                  onClick={()=>setModalElimDef(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={handleEliminarDef}>
                  <i className="bi bi-trash-fill me-1"></i>Sí, eliminar definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}