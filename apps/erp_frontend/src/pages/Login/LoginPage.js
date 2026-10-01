import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Sin respuesta del servidor: NO es un problema de credenciales.
function mensajeErrorLogin(err) {
  const res = err.response;
  if (!res) return 'No se pudo conectar con el servidor.';

  const { status, data } = res;
  const ct = res.headers?.['content-type'] || '';

  // Con Django apagado, el proxy de CRA (Express) contesta 500 sin content-type y
  // con cuerpo "Proxy error: ... (ECONNREFUSED)". Django siempre envia uno, asi que
  // la ausencia del header distingue "backend caido" de un 500 real del servidor.
  if (status >= 500 && !ct) {
    return 'No hay conexión con el backend. Verifica que Django esté corriendo en el puerto 8000.';
  }
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) {
    return data.non_field_errors[0];
  }
  if (status === 400 || status === 401) return 'Credenciales no coinciden';
  if (status >= 500) return 'El servidor devolvió un error. Revisa la consola de Django.';
  return `Error ${status} al iniciar sesión.`;
}

export default function LoginPage() {
  const [usuario,  setUsuario]  = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(usuario, password);
      toast.success('Bienvenido al sistema');
      navigate('/dashboard');
    } catch (err) {
      toast.error(mensajeErrorLogin(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card shadow-sm border-0" style={{ width: 400 }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <i className="bi bi-calculator display-4 text-success"></i>
            <h4 className="fw-bold mt-2">SDIES</h4>
            <p className="text-muted small">Sistema de Contabilidad Profesional</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Usuario o correo electrónico</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-person"></i></span>
                <input type="text" className="form-control" placeholder="Login o correo"
                  value={usuario} onChange={e => setUsuario(e.target.value)} required />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Contraseña</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-lock"></i></span>
                <input type={showPass ? 'text' : 'password'} className="form-control"
                  placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required />
                <button type="button" className="input-group-text"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}>
                  <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-success w-100 fw-semibold"
              disabled={loading}>
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Ingresando...</>
                : <><i className="bi bi-box-arrow-in-right me-2"></i>Ingresar</>
              }
            </button>
            <div className="text-center mt-3">
              <button type="button" className="btn btn-link btn-sm p-0"
                onClick={() => navigate('/recuperar-contrasena')}>
                <i className="bi bi-question-circle me-1"></i>¿Olvidó su contraseña?
              </button>
            </div>
          </form>
        </div>
        <div className="card-footer text-center text-muted small py-2">
          v1.0.0 — Django REST + React
        </div>
      </div>
    </div>
  );
}
