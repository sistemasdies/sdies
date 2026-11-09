import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import Spinner from '../../components/common/Spinner';
import { getCumpleanos } from '../../api/terceros';
import { updateMe } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formato';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, refrescar, marca } = useAuth();
  const [cumpleanos, setCumpleanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCumple, setShowCumple] = useState(false);

  const [modalPerfil, setModalPerfil] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [perfil, setPerfil] = useState({
    NameUser: '', email: '', caja_user: '', centro_costo_user: '',
    fecha_nacimiento: '', frase_verificacion: '',
  });

  const abrirPerfil = () => {
    setPerfil({
      NameUser: user?.NameUser || '', email: user?.email || '',
      caja_user: user?.caja_user || '', centro_costo_user: user?.centro_costo_user || '',
      fecha_nacimiento: user?.fecha_nacimiento || '', frase_verificacion: user?.frase_verificacion || '',
    });
    setModalPerfil(true);
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    setGuardandoPerfil(true);
    try {
      await updateMe({
        NameUser: perfil.NameUser.trim(), email: perfil.email.trim(),
        caja_user: perfil.caja_user.trim(), centro_costo_user: perfil.centro_costo_user.trim(),
        fecha_nacimiento: perfil.fecha_nacimiento || null, frase_verificacion: perfil.frase_verificacion.trim(),
      });
      await refrescar();
      toast.success('Datos actualizados');
      setModalPerfil(false);
    } catch (err) {
      const d = err.response?.data?.detail || err.response?.data;
      if (d?.email) toast.error(`Email "${perfil.email}" ya está registrado`);
      else if (typeof d === 'string') toast.error(d);
      else toast.error('Error al guardar — verifique los datos');
    } finally { setGuardandoPerfil(false); }
  };

  useEffect(() => {
    getCumpleanos({ dias: 10 })
      .then(r => setCumpleanos(r.data.resultados || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <MainLayout><TopBar title="Dashboard" /><div className="p-4"><Spinner /></div></MainLayout>
  );

  return (
    <MainLayout>
      <TopBar title="Dashboard" LabelVersion="v 1.18">
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-sm btn-outline-success"
            onClick={abrirPerfil} title="Mis datos">
            <i className="bi bi-person-gear me-1"></i>Mis Datos
          </button>
          <button type="button" className="btn btn-sm btn-outline-success"
            onClick={() => setShowCumple(true)} title="Cumpleaños">
            <i className="bi bi-cake2 me-1"></i>Cumpleaños
          </button>
        </div>
      </TopBar>
      <div className="p-4">
        {/* Imagen de fondo */}
        <div className="card border-0 shadow-sm mb-3">
          {marca?.FondoDeLaApp ? (
            <img src={marca.FondoDeLaApp} alt="Fondo" className="card-img" style={{ display: 'block', width: '100%', height: 'auto' }} />
          ) : (
            <div className="card-body" style={{ minHeight: 200 }}></div>
          )}
        </div>
      </div>

      {/* Modal: editar mis datos */}
      {modalPerfil && (
        <div className="modal d-block" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480 }}>
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-person-gear me-2"></i>
                  Mis datos
                </h5>
                <button className="btn-close btn-close-white" onClick={()=>setModalPerfil(false)}></button>
              </div>
              <form onSubmit={guardarPerfil} autoComplete="off">
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Nombre completo <span className="text-danger">*</span>
                      </label>
                      <input className="form-control" maxLength={30}
                        value={perfil.NameUser} required autoComplete="off"
                        placeholder="Nombre y apellido"
                        onChange={e=>setPerfil({...perfil, NameUser:e.target.value})}/>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input type="email" className="form-control"
                        value={perfil.email} required autoComplete="off"
                        placeholder="correo@dominio.com"
                        onChange={e=>setPerfil({...perfil, email:e.target.value})}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Caja user</label>
                      <input className="form-control font-monospace" maxLength={8}
                        value={perfil.caja_user} placeholder="Caja"
                        onChange={e=>setPerfil({...perfil, caja_user:e.target.value})}/>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Centro de costo user</label>
                      <input className="form-control font-monospace" maxLength={7}
                        value={perfil.centro_costo_user} placeholder="C. costo"
                        onChange={e=>setPerfil({...perfil, centro_costo_user:e.target.value})}/>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Fecha de nacimiento</label>
                      <input type="date" className="form-control"
                        value={perfil.fecha_nacimiento || ''}
                        onChange={e=>setPerfil({...perfil, fecha_nacimiento:e.target.value})}/>
                      <small className="text-muted">Se usa en la recuperación de contraseña</small>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Frase de verificación</label>
                      <input type="password" className="form-control" maxLength={30}
                        value={perfil.frase_verificacion}
                        placeholder="Máximo 30 caracteres"
                        onChange={e=>setPerfil({...perfil, frase_verificacion:e.target.value})}/>
                      <small className="text-muted">Se elige un señuelo de esta frase al recuperar la contraseña</small>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary"
                    onClick={()=>setModalPerfil(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={guardandoPerfil}>
                    {guardandoPerfil
                      ?<><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                      :<><i className="bi bi-check2 me-1"></i>Guardar</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Popup Cumpleaños */}
      {showCumple && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ width: '50%', maxWidth: '50%' }}>
            <div className="modal-content shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><i className="bi bi-cake2 me-2"></i>Cumpleaños</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCumple(false)}></button>
              </div>
              <div className="modal-body p-0">
                {cumpleanos.length === 0 ? (
                  <div className="text-muted small text-center py-4">Sin cumpleaños en los próximos 10 días.</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {cumpleanos.map(c => (
                      <div key={c.cedula} className="list-group-item py-2 px-3">
                        <div className="small fw-semibold text-truncate">{c.nombre}</div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="text-muted" style={{ fontSize: 11 }}>CC {c.cedula}</span>
                          <span className="text-end text-nowrap">
                            <span className="badge bg-success">{formatDate(c.fecha_cumple)}</span>
                            <span className="text-muted ms-1" style={{ fontSize: 11 }}>{c.dias === 0 ? 'Hoy' : c.dias === 1 ? 'Mañana' : `En ${c.dias} días`}</span>
                          </span>
                        </div>
                      </div>
                    ))}
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
