import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

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
      const data = err.response?.data;
      let msg = 'Credenciales no coinciden';
      if (data) {
        if (typeof data.detail === 'string') msg = data.detail;
        else if (data.non_field_errors) msg = data.non_field_errors[0];
      }
      toast.error(msg);
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
