import { useEffect, useState, useMemo } from 'react';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const ACCIONES = ['acceder', 'listar', 'agregar', 'editar', 'borrar', 'anular'];

export default function ModalPermisosMasivos({
  abierto, onCerrar, roles, permisos, onGuardar, cargando,
}) {
  const [seleccion, setSeleccion] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const inicial = {};
    roles.forEach(r => {
      inicial[r.id] = new Set((r.permissions || []).map(p => p.id));
    });
    setSeleccion(inicial);
  }, [abierto, roles]);

  const permisosOrdenados = useMemo(() =>
    [...permisos].sort((a, b) => a.code.localeCompare(b.code)),
  [permisos]);

  const rolesOrdenados = useMemo(() =>
    [...roles].sort((a, b) => a.NameRole.localeCompare(b.NameRole)),
  [roles]);

  if (!abierto) return null;

  const toggleCell = (roleId, permId) => {
    setSeleccion(prev => {
      const setRol = new Set(prev[roleId] || []);
      if (setRol.has(permId)) setRol.delete(permId);
      else setRol.add(permId);
      return { ...prev, [roleId]: setRol };
    });
  };

  const toggleRol = (roleId) => {
    setSeleccion(prev => {
      const setRol = prev[roleId];
      const todos = permisosOrdenados.length;
      const todosSeleccionados = setRol && setRol.size === todos;
      return {
        ...prev,
        [roleId]: todosSeleccionados ? new Set() : new Set(permisosOrdenados.map(p => p.id)),
      };
    });
  };

  const togglePermiso = (permId) => {
    setSeleccion(prev => {
      const todosRoles = rolesOrdenados.length;
      const seleccionados = rolesOrdenados.filter(r => (prev[r.id] || new Set()).has(permId)).length;
      const marcar = seleccionados !== todosRoles;
      const nuevo = { ...prev };
      rolesOrdenados.forEach(r => {
        const setRol = new Set(nuevo[r.id] || []);
        if (marcar) setRol.add(permId);
        else setRol.delete(permId);
        nuevo[r.id] = setRol;
      });
      return nuevo;
    });
  };

  const aplicarAccion = (accion, marcar) => {
    const idsPerm = permisosOrdenados.filter(p => p.code.endsWith(`.${accion}`)).map(p => p.id);
    setSeleccion(prev => {
      const nuevo = { ...prev };
      rolesOrdenados.forEach(r => {
        const setRol = new Set(nuevo[r.id] || []);
        idsPerm.forEach(pid => {
          if (marcar) setRol.add(pid);
          else setRol.delete(pid);
        });
        nuevo[r.id] = setRol;
      });
      return nuevo;
    });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = {};
      Object.entries(seleccion).forEach(([roleId, setRol]) => {
        payload[roleId] = Array.from(setRol);
      });
      await onGuardar(payload);
      toast.success('Permisos actualizados');
      onCerrar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar permisos');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
      <div className="modal-dialog modal-fullscreen modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white flex-shrink-0">
            <h5 className="modal-title">
              <i className="bi bi-key me-2"></i>Áreas Permitidas — edición masiva
            </h5>
            <button className="btn-close btn-close-white" onClick={onCerrar} disabled={guardando}></button>
          </div>

          <div className="modal-body bg-light">
            <div className="alert alert-light border small py-2 mb-3">
              <i className="bi bi-info-circle me-2"></i>
              Marque o desmarque los permisos por rol. Use los encabezados de columna para un rol completo
              o el botón de cada fila para todos los roles de un permiso. Los cambios se guardan al presionar
              <strong> Guardar permisos</strong>.
            </div>

            <div className="d-flex gap-2 flex-wrap mb-3">
              <span className="small text-muted align-self-center me-2">Acciones rápidas:</span>
              {ACCIONES.map(a => (
                <div key={a} className="btn-group btn-group-sm">
                  <button className="btn btn-outline-success" onClick={() => aplicarAccion(a, true)}>
                    <i className="bi bi-check-square me-1"></i>{a}
                  </button>
                  <button className="btn btn-outline-danger" onClick={() => aplicarAccion(a, false)}>
                    <i className="bi bi-square me-1"></i>{a}
                  </button>
                </div>
              ))}
            </div>

            {cargando ? <div className="py-5"><Spinner /></div> : (
              <div className="table-responsive" style={{ maxHeight: '65vh' }}>
                <table className="table table-bordered table-sm align-middle bg-white mb-0">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th className="sticky-left bg-dark text-white" style={{ minWidth: 280, left: 0, zIndex: 2 }}>
                        Permiso
                      </th>
                      {rolesOrdenados.map(r => (
                        <th key={r.id} className="text-center" style={{ minWidth: 90, cursor: 'pointer' }}
                          onClick={() => toggleRol(r.id)} title="Marcar/desmarcar todos los permisos de este rol">
                          <div className="small fw-semibold text-truncate" style={{ maxWidth: 120 }}>{r.NameRole}</div>
                          <input type="checkbox" className="form-check-input mt-1"
                            checked={seleccion[r.id]?.size === permisosOrdenados.length && permisosOrdenados.length > 0}
                            onChange={() => toggleRol(r.id)} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permisosOrdenados.length === 0 && (
                      <tr><td colSpan={rolesOrdenados.length + 1} className="text-center text-muted py-4">Sin permisos</td></tr>
                    )}
                    {permisosOrdenados.map(p => {
                      const seleccionados = rolesOrdenados.filter(r => (seleccion[r.id] || new Set()).has(p.id)).length;
                      const todos = rolesOrdenados.length;
                      return (
                        <tr key={p.id}>
                          <td className="sticky-left bg-white" style={{ left: 0, zIndex: 1 }}>
                            <div className="d-flex align-items-center gap-2">
                              <input type="checkbox" className="form-check-input"
                                checked={seleccionados === todos && todos > 0}
                                onChange={() => togglePermiso(p.id)} />
                              <div>
                                <div className="small fw-semibold">{p.name}</div>
                                <div className="small text-muted font-monospace">{p.code}</div>
                              </div>
                            </div>
                          </td>
                          {rolesOrdenados.map(r => {
                            const sel = (seleccion[r.id] || new Set()).has(p.id);
                            return (
                              <td key={r.id} className="text-center">
                                <input type="checkbox" className="form-check-input"
                                  checked={sel} onChange={() => toggleCell(r.id, p.id)} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer flex-shrink-0">
            <button className="btn btn-secondary" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </button>
            <button className="btn btn-success" onClick={guardar} disabled={guardando || cargando}>
              {guardando
                ? <><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                : <><i className="bi bi-check2 me-1"></i>Guardar permisos</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
