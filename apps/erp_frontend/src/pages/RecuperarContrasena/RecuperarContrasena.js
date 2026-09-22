import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recuperarPaso1, recuperarPaso2, recuperarPaso3, recuperarPaso4 } from '../../api/auth';
import toast from 'react-hot-toast';

export default function RecuperarContrasena() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(0);
  const [login, setLogin] = useState('');
  const [fecha, setFecha] = useState('');
  const [opciones, setOpciones] = useState([]);
  const [token, setToken] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [loading, setLoading] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [mensajeFallo, setMensajeFallo] = useState('');

  const err = (e) => toast.error(e.response?.data?.detail || 'Error inesperado.');

  const enviarPaso1 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await recuperarPaso1(login.trim());
      setPaso(1);
    } catch (error) { err(error); } finally { setLoading(false); }
  };

  const enviarPaso2 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await recuperarPaso2(login.trim(), fecha);
      setOpciones(data.opciones);
      setPaso(2);
    } catch (error) { err(error); } finally { setLoading(false); }
  };

  const enviarPaso3 = async (frase) => {
    setLoading(true);
    try {
      const { data } = await recuperarPaso3(login.trim(), frase);
      setToken(data.token);
      setPaso(3);
    } catch (error) {
      setFallo(true);
      setMensajeFallo(error.response?.data?.detail || 'Error inesperado.');
    } finally { setLoading(false); }
  };

  const enviarPaso4 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await recuperarPaso4(token, clave, clave2);
      toast.success('Contraseña actualizada. Ya puede ingresar.');
      navigate('/login');
    } catch (error) { err(error); } finally { setLoading(false); }
  };

  const titulo = ['Identificación', 'Fecha de nacimiento', 'Elija su frase', 'Nueva contraseña'];

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card shadow-sm border-0" style={{ width: 450 }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <i className="bi bi-shield-lock display-4 text-success"></i>
            <h4 className="fw-bold mt-2">Recuperar contraseña</h4>
            {/* Stepper */}
            <div className="d-flex justify-content-center gap-1 mt-3">
              {[0,1,2,3].map(i => (
                <span key={i} className={`rounded-circle d-inline-flex align-items-center justify-content-center ${paso > i ? 'bg-success text-white' : paso === i ? 'bg-success text-white border border-dark-subtle' : 'bg-light border text-muted'}`}
                  style={{ width: 26, height: 26, fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
              ))}
            </div>
            <p className="text-muted small mt-2 mb-0">{titulo[paso]}</p>
          </div>

          {paso === 0 && (
            <form onSubmit={enviarPaso1}>
              <label className="form-label small fw-semibold">Usuario o correo electrónico</label>
              <input className="form-control" autoFocus placeholder="Login o correo"
                value={login} onChange={e => setLogin(e.target.value)} required />
              <button className="btn btn-success w-100 fw-semibold mt-3" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Verificando...</> : 'Continuar'}
              </button>
            </form>
          )}

          {paso === 1 && (
            <form onSubmit={enviarPaso2}>
              <p className="small text-muted mb-3">
                Verifique su identidad respondiendo la pregunta de seguridad.
              </p>
              <label className="form-label small fw-semibold">Fecha de nacimiento</label>
              <input type="date" className="form-control" autoFocus
                value={fecha} onChange={e => setFecha(e.target.value)} required />
              <button className="btn btn-success w-100 fw-semibold mt-3" disabled={loading || !fecha}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Verificando...</> : 'Continuar'}
              </button>
            </form>
          )}

          {paso === 2 && (
            <div>
              {fallo ? (
                <div className="alert alert-danger small mb-0">
                  <i className="bi bi-shield-exclamation me-1"></i>
                  {mensajeFallo}
                </div>
              ) : (
                <>
                  <div className="alert alert-warning py-2 small mb-3">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Solo tiene <strong>UNA oportunidad</strong>. Si falla, su cuenta quedará
                    <strong> desactivada</strong> y deberá contactar al administrador.
                  </div>
                  <p className="small text-muted mb-3">
                    Elija cuál de las siguientes frases es <strong>su frase de verificación</strong>:
                  </p>
                  {opciones.map((op, i) => (
                    <button key={op.id} type="button" className="btn btn-outline-success w-100 text-start mb-2"
                      disabled={loading} onClick={() => enviarPaso3(op.frase)}>
                      <strong className="me-2">{['a','b','c'][i]}.</strong> {op.frase}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {paso === 3 && (
            <form onSubmit={enviarPaso4}>
              <p className="small text-muted mb-3">
                Felicitaciones, verificó su identidad. Defina su nueva contraseña.
              </p>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Nueva contraseña</label>
                <input type="password" className="form-control" autoFocus minLength={8}
                  placeholder="Mínimo 8 caracteres" value={clave}
                  onChange={e => setClave(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Repita la contraseña</label>
                <input type="password" className={`form-control ${clave2 && clave2 !== clave ? 'is-invalid' : ''}`}
                  minLength={8} placeholder="Mínimo 8 caracteres" value={clave2}
                  onChange={e => setClave2(e.target.value)} required />
                {clave2 && clave2 !== clave && (
                  <div className="invalid-feedback d-block">Las contraseñas no coinciden.</div>
                )}
              </div>
              <button className="btn btn-success w-100 fw-semibold"
                disabled={loading || !clave || !clave2 || clave !== clave2 || clave.length < 8}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</> : 'Guardar nueva contraseña'}
              </button>
            </form>
          )}

          <div className="text-center mt-3">
            <button className="btn btn-link btn-sm p-0" onClick={() => navigate('/login')}>
              <i className="bi bi-arrow-left me-1"></i>Volver al ingreso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}