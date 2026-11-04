import { useEffect, useState, useMemo } from 'react';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

export default function ModalControlesMasivos({
  abierto, onCerrar, roles, catalogo, onGuardar, cargando,
}) {
  const [seleccion, setSeleccion] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const inicial = {};
    roles.forEach(r => {
      inicial[r.id] = { ...(r.controles || {}) };
    });
    setSeleccion(inicial);
  }, [abierto, roles]);

  const rolesOrdenados = useMemo(() =>
    [...roles].sort((a, b) => a.NameRole.localeCompare(b.NameRole)),
  [roles]);

  if (!abierto) return null;

  const setControl = (roleId, code, valor) => {
    setSeleccion(prev => ({
      ...prev,
      [roleId]: { ...(prev[roleId] || {}), [code]: valor },
    }));
  };

  const toggleCell = (roleId, code) => {
    const actual = seleccion[roleId]?.[code] || 'P';
    setControl(roleId, code, actual === 'P' ? 'D' : 'P');
  };

  const toggleRol = (roleId) => {
    setSeleccion(prev => {
      const rolMap = prev[roleId] || {};
      const todosPermitidos = catalogo.every(c => (rolMap[c.code] || 'P') === 'P');
      const nuevoValor = todosPermitidos ? 'D' : 'P';
      const nuevo = { ...rolMap };
      catalogo.forEach(c => { nuevo[c.code] = nuevoValor; });
      return { ...prev, [roleId]: nuevo };
    });
  };

  const toggleControl = (code) => {
    setSeleccion(prev => {
      const todos = rolesOrdenados.length;
      const permitidos = rolesOrdenados.filter(r => (prev[r.id]?.[code] || 'P') === 'P').length;
      const nuevoValor = permitidos === todos ? 'D' : 'P';
      const nuevo = { ...prev };
      rolesOrdenados.forEach(r => {
        nuevo[r.id] = { ...(nuevo[r.id] || {}), [code]: nuevoValor };
      });
      return nuevo;
    });
  };

  const aplicarGlobal = (valor) => {
    setSeleccion(prev => {
      const nuevo = {};
      rolesOrdenados.forEach(r => {
        const map = {};
        catalogo.forEach(c => { map[c.code] = valor; });
        nuevo[r.id] = map;
      });
      return nuevo;
    });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = {};
      Object.entries(seleccion).forEach(([roleId, map]) => {
        payload[roleId] = { ...map };
      });
      await onGuardar(payload);
      toast.success('Controles actualizados');
      onCerrar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar controles');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
      <div className="modal-dialog modal-fullscreen modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white flex-shrink-0">
            <h5 className="modal-title">
              <i className="bi bi-toggle2-on me-2"></i>Controles Permitidos — edición masiva
            </h5>
            <button className="btn-close btn-close-white" onClick={onCerrar} disabled={guardando}></button>
          </div>

          <div className="modal-body bg-light">
            <div className="alert alert-light border small py-2 mb-3">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Permitido</strong> (P) muestra el botón u opción; <strong>Denegado</strong> (D) lo oculta.
              Use los encabezados de columna para un rol completo o el botón de cada fila para todos los roles de un control.
            </div>

            <div className="d-flex gap-2 flex-wrap mb-3">
              <span className="small text-muted align-self-center me-2">Acciones rápidas:</span>
              <button className="btn btn-sm btn-outline-success" onClick={() => aplicarGlobal('P')}>
                <i className="bi bi-check-square me-1"></i>Todo Permitido
              </button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => aplicarGlobal('D')}>
                <i className="bi bi-square me-1"></i>Todo Denegado
              </button>
            </div>

            {cargando ? <div className="py-5"><Spinner /></div> : (
              <div className="table-responsive" style={{ maxHeight: '65vh' }}>
                <table className="table table-bordered table-sm align-middle bg-white mb-0">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th className="sticky-left bg-dark text-white" style={{ minWidth: 320, left: 0, zIndex: 2 }}>
                        Control
                      </th>
                      {rolesOrdenados.map(r => {
                        const map = seleccion[r.id] || {};
                        const todosP = catalogo.every(c => (map[c.code] || 'P') === 'P');
                        return (
                          <th key={r.id} className="text-center" style={{ minWidth: 90, cursor: 'pointer' }}
                            onClick={() => toggleRol(r.id)} title="Marcar/desmarcar todos los controles de este rol">
                            <div className="small fw-semibold text-truncate" style={{ maxWidth: 120 }}>{r.NameRole}</div>
                            <span className={`badge ${todosP ? 'bg-success' : 'bg-danger'}`}>
                              {todosP ? 'P' : 'D'}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {catalogo.length === 0 && (
                      <tr><td colSpan={rolesOrdenados.length + 1} className="text-center text-muted py-4">Sin controles</td></tr>
                    )}
                    {catalogo.map(c => {
                      const permitidos = rolesOrdenados.filter(r => (seleccion[r.id]?.[c.code] || 'P') === 'P').length;
                      const todos = rolesOrdenados.length;
                      return (
                        <tr key={c.code}>
                          <td className="sticky-left bg-white" style={{ left: 0, zIndex: 1 }}>
                            <div className="d-flex align-items-center gap-2">
                              <button type="button" className={`btn btn-sm ${permitidos === todos && todos > 0 ? 'btn-success' : 'btn-outline-success'}`}
                                onClick={() => toggleControl(c.code)} title="Alternar este control en todos los roles">
                                <i className={`bi ${permitidos === todos && todos > 0 ? 'bi-check-square' : 'bi-square'}`}></i>
                              </button>
                              <div>
                                <div className="small fw-semibold">{c.label}</div>
                                <div className="small text-muted">{c.desc}</div>
                                <div className="small text-muted font-monospace">{c.code}</div>
                              </div>
                            </div>
                          </td>
                          {rolesOrdenados.map(r => {
                            const val = seleccion[r.id]?.[c.code] || 'P';
                            const permitido = val === 'P';
                            return (
                              <td key={r.id} className="text-center">
                                <button type="button"
                                  className={`btn btn-sm ${permitido ? 'btn-success' : 'btn-danger'}`}
                                  onClick={() => toggleCell(r.id, c.code)}
                                  title={permitido ? 'Permitido — click para denegar' : 'Denegado — click para permitir'}>
                                  <i className={`bi ${permitido ? 'bi-check-lg' : 'bi-x-lg'}`}></i>
                                </button>
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
            <button className="btn btn-primary" onClick={guardar} disabled={guardando || cargando}>
              {guardando
                ? <><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                : <><i className="bi bi-check2 me-1"></i>Guardar controles</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
