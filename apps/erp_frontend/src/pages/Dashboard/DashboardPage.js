import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import Spinner from '../../components/common/Spinner';
import { getEstadoResultados } from '../../api/reportes';
import { getAsientos } from '../../api/asientos';
import { getCumpleanos } from '../../api/terceros';
import { updateMe } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { usePreferencias } from '../../hooks/usePreferencias';
import { formatMoney, formatDate } from '../../utils/formato';
import toast from 'react-hot-toast';

const hoyISO = () => new Date().toISOString().split('T')[0];

const etiquetaDias = (d) =>
  d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`;

export default function DashboardPage() {
  const { user, refrescar } = useAuth();
  const anio = new Date().getFullYear();
  const [desde, setDesde] = useState(`${anio}-01-01`);
  const [hasta, setHasta] = useState(hoyISO());
  const [resumen, setResumen] = useState(null);
  const [cargandoResumen, setCargandoResumen] = useState(true);
  const [cumpleanos, setCumpleanos] = useState([]);
  const [asientos,  setAsientos]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const { data: prefs, estaListo: prefsListo, guardar: guardarPrefs } = usePreferencias();

  // Perfil propio
  const [modalPerfil, setModalPerfil] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [perfil, setPerfil] = useState({
    NameUser:'', email:'', caja_user:'', centro_costo_user:'',
    fecha_nacimiento:'', frase_verificacion:'',
  });

  const abrirPerfil = () => {
    setPerfil({
      NameUser:          user?.NameUser || '',
      email:             user?.email || '',
      caja_user:         user?.caja_user || '',
      centro_costo_user: user?.centro_costo_user || '',
      fecha_nacimiento:  user?.fecha_nacimiento || '',
      frase_verificacion:user?.frase_verificacion || '',
    });
    setModalPerfil(true);
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    setGuardandoPerfil(true);
    try {
      await updateMe({
        NameUser:           perfil.NameUser.trim(),
        email:              perfil.email.trim(),
        caja_user:          perfil.caja_user.trim(),
        centro_costo_user:  perfil.centro_costo_user.trim(),
        fecha_nacimiento:   perfil.fecha_nacimiento || null,
        frase_verificacion: perfil.frase_verificacion.trim(),
      });
      await refrescar();
      toast.success('Datos actualizados');
      setModalPerfil(false);
    } catch (err) {
      const d = err.response?.data?.detail || err.response?.data;
      if (d?.email)                    toast.error(`Email "${perfil.email}" ya está registrado`);
      else if (typeof d === 'string')  toast.error(d);
      else if (Array.isArray(Object.values(d||{})[0])) toast.error(Object.values(d)[0][0]);
      else                             toast.error('Error al guardar — verifique los datos');
    } finally { setGuardandoPerfil(false); }
  };

  useEffect(() => {
    Promise.allSettled([
      getCumpleanos({ dias: 10 }),
      getAsientos({ page_size: 5 }),
    ]).then(([c, a]) => {
      if (c.status === 'fulfilled') setCumpleanos(c.value.data.resultados || []);
      if (a.status === 'fulfilled') setAsientos(a.value.data.results || []);
    }).finally(() => setLoading(false));
  }, []);

  // Rehidratar rango de fechas guardado por el usuario
  useEffect(() => {
    if (!prefsListo || !prefs) return;
    const g = prefs['dashboard'];
    if (g) {
      if (g.desde) setDesde(g.desde);
      if (g.hasta) setHasta(g.hasta);
    }
  }, [prefsListo]);

  // Persistir el rango de fechas en las preferencias del usuario (con debounce)
  useEffect(() => {
    if (!prefsListo || !guardarPrefs) return;
    const t = setTimeout(() => {
      guardarPrefs({ dashboard: { desde, hasta } });
    }, 600);
    return () => clearTimeout(t);
  }, [desde, hasta, prefsListo]);

  useEffect(() => {
    let activo = true;
    setCargandoResumen(true);
    getEstadoResultados({ fecha_desde: desde, fecha_hasta: hasta, excluir_cierre: '1' })
      .then(r => { if (activo) setResumen(r.data); })
      .catch(() => {})
      .finally(() => { if (activo) setCargandoResumen(false); });
    return () => { activo = false; };
  }, [desde, hasta]);

  const ingresos  = parseFloat(resumen?.ingresos || 0);
  const gastos    = parseFloat(resumen?.gastos   || 0);
  const superavit = ingresos - gastos;

  const kpis = [
    { label: 'Bienvenido', texto: user?.NameUser || user?.login || '',
      icon: 'bi-person-circle', color: 'success' },
    { label: 'Ingresos', value: ingresos, icon: 'bi-graph-up-arrow', color: 'success' },
    { label: 'Gastos',   value: gastos,   icon: 'bi-graph-down-arrow', color: 'danger' },
    { label: superavit >= 0 ? 'Superávit' : 'Déficit', value: Math.abs(superavit),
      icon: superavit >= 0 ? 'bi-emoji-smile' : 'bi-emoji-frown',
      color: superavit >= 0 ? 'success' : 'danger' },
  ];

  if (loading) return (
    <MainLayout><TopBar title="Dashboard" /><div className="p-4"><Spinner /></div></MainLayout>
  );

  return (
    <MainLayout>
      <TopBar title="Dashboard">
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small">Del</span>
          <input type="date" className="form-control form-control-sm"
            style={{ width: 150 }} value={desde} max={hasta}
            onChange={e => setDesde(e.target.value)} />
          <span className="text-muted small">al</span>
          <input type="date" className="form-control form-control-sm"
            style={{ width: 150 }} value={hasta} min={desde}
            onChange={e => setHasta(e.target.value)} />
        </div>
      </TopBar>
      <div className="p-4">

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {kpis.map(({ label, value, texto, icon, color }) => (
            <div key={label} className="col-md-3">
              <div className="card border-0 shadow-sm h-100"
                style={label==='Bienvenido' ? { cursor: 'pointer' } : undefined}
                onClick={label==='Bienvenido' ? abrirPerfil : undefined}>
                <div className="card-body py-2 px-3">
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      {label}{label==='Bienvenido'&&<i className="bi bi-pencil-square ms-1" style={{fontSize:10}}></i>}
                    </span>
                    <i className={`bi ${icon} text-${color}`}></i>
                  </div>
                  <div className={`fw-bold text-${color} text-truncate`} style={{ fontSize: 15 }}
                    title={texto !== undefined ? 'Editar mis datos' : undefined}>
                    {texto !== undefined ? texto : (cargandoResumen ? '…' : formatMoney(value))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="row g-3">
          {/* Cuadro central (en blanco): ancho de dos rótulos (cols 1-6) */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body" style={{ minHeight: 400 }}></div>
            </div>
          </div>

          {/* Columna derecha (cols 7-12): cumpleaños + últimos asientos */}
          <div className="col-md-6">
            <div className="d-flex flex-column gap-3">

              {/* Cumpleaños */}
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 fw-semibold">
                  <i className="bi bi-cake2 me-2 text-success"></i>
                  Cumpleaños
                </div>
                <div className="card-body p-0">
                  {cumpleanos.length === 0 ? (
                    <div className="text-muted small text-center py-4">
                      Sin cumpleaños en los próximos 10 días.
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {cumpleanos.map(c => (
                        <div key={c.cedula} className="list-group-item py-2 px-3">
                          <div className="small fw-semibold text-truncate">{c.nombre}</div>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted" style={{ fontSize: 11 }}>CC {c.cedula}</span>
                            <span className="text-end text-nowrap">
                              <span className="badge bg-success">{formatDate(c.fecha_cumple)}</span>
                              <span className="text-muted ms-1" style={{ fontSize: 11 }}>
                                {etiquetaDias(c.dias)}
                              </span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Últimos asientos */}
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 fw-semibold">
                  <i className="bi bi-journal-text me-2 text-success"></i>
                  Últimos asientos
                </div>
                <div className="table-responsive">
                  <table className="table table-hover table-sm mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Referencia</th>
                        <th>Fecha</th>
                        <th className="text-end">Débitos</th>
                        <th className="text-end">Créditos</th>
                        <th className="text-end">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asientos.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-muted py-3">Sin asientos</td></tr>
                      )}
                      {asientos.map(a => {
                        const dif = Math.abs((parseFloat(a.total_debitos)||0) - (parseFloat(a.total_creditos)||0));
                        const descuadrado = dif >= 0.01;
                        return (
                        <tr key={`${a.cod_comprob}-${a.num_comprob}`}
                            className={descuadrado ? 'table-danger fw-bold' : ''}>
                          <td><code className="small">{a.referencia}</code></td>
                          <td className="small">{a.fecha}</td>
                          <td className="text-end small">{formatMoney(a.total_debitos)}</td>
                          <td className="text-end small">{formatMoney(a.total_creditos)}</td>
                          <td className="text-end small">
                            {descuadrado ? (
                              <span className="text-danger fw-bold">
                                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                {formatMoney(dif)}
                              </span>
                            ) : (
                              <span className="text-success">
                                <i className="bi bi-check-circle-fill me-1"></i>
                                {formatMoney(0)}
                              </span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
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
    </MainLayout>
  );
}
