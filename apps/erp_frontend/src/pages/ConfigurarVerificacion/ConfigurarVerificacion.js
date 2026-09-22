import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { configurarVerificacion } from '../../api/auth';
import toast from 'react-hot-toast';

export default function ConfigurarVerificacion() {
  const navigate  = useNavigate();
  const { user, refrescar, logout } = useAuth();
  const [fecha,  setFecha]  = useState('');
  const [frase,  setFrase]  = useState('');
  const [frase2, setFrase2] = useState('');
  const [loading, setLoading] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await configurarVerificacion(fecha, frase.trim(), frase2.trim());
      await refrescar();
      toast.success('Datos de verificación guardados.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card shadow-sm border-0" style={{ width: 480 }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <i className="bi bi-shield-check display-4 text-success"></i>
            <h4 className="fw-bold mt-2">Configurar verificación</h4>
            <p className="text-muted small mb-0">
              Hola <strong>{user?.NameUser}</strong>. Antes de continuar debe configurar sus datos de
              recuperación de contraseña.
            </p>
          </div>
          <form onSubmit={enviar}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">
                <i className="bi bi-calendar2-heart me-1 text-primary"></i>Fecha de nacimiento *
              </label>
              <input type="date" className="form-control" autoFocus
                value={fecha} onChange={e => setFecha(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">
                <i className="bi bi-chat-quote me-1 text-primary"></i>Frase de verificación *
              </label>
              <input className={`form-control ${frase && frase.length > 30 ? 'is-invalid' : ''}`}
                maxLength={40} placeholder="Ej: Camino verdadero" value={frase}
                onChange={e => setFrase(e.target.value)} required />
              <div className="form-text">Máximo 30 caracteres. Recuerde esta frase; la usará si olvida su contraseña.</div>
              {frase.length > 30 && (
                <div className="invalid-feedback d-block">La frase no puede superar 30 caracteres.</div>
              )}
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">
                <i className="bi bi-chat-quote me-1 text-primary"></i>Repita la frase de verificación *
              </label>
              <input className={`form-control ${frase2 && frase2 !== frase ? 'is-invalid' : ''}`}
                placeholder="Repita la frase" value={frase2}
                onChange={e => setFrase2(e.target.value)} required />
              {frase2 && frase2 !== frase && (
                <div className="invalid-feedback d-block">Las frases no coinciden.</div>
              )}
            </div>
            <button className="btn btn-success w-100 fw-semibold"
              disabled={loading || !fecha || !frase.trim() || !frase2.trim()
                || frase.trim().length > 30 || frase !== frase2}>
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                : <><i className="bi bi-check2-circle me-2"></i>Guardar y continuar</>}
            </button>
          </form>
          <div className="text-center mt-3">
            <button className="btn btn-link btn-sm p-0 text-danger"
              onClick={() => { logout(); navigate('/login'); }}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}