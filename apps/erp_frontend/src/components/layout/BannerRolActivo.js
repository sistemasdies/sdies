import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

/**
 * Aviso permanente mientras el administrador usa otro rol.
 * Es la salida garantizada: el rol asumido podría no tener acceso a /roles.
 */
export default function BannerRolActivo() {
  const { user, retomarRol } = useAuth();
  const [saliendo, setSaliendo] = useState(false);

  if (!user?.rol_activo) return null;

  const handleRetomar = async () => {
    setSaliendo(true);
    try {
      await retomarRol();
      toast.success('Retomó su rol de administrador');
    } catch (error) {
      // retomarRol ya limpió el estado local aunque falle la confirmación.
      toast.error(error.response?.data?.detail || 'Se retomó el rol localmente');
    } finally {
      setSaliendo(false);
    }
  };

  return (
    <div
      className="alert alert-warning border-0 rounded-0 d-flex align-items-center
                 justify-content-between gap-3 mb-0 px-4 py-2 sticky-top"
      style={{ zIndex: 1040 }}
      role="alert"
    >
      <div className="small">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        Está usando el rol <strong>{user.rol_activo.nombre}</strong>.
        <span className="d-none d-md-inline text-muted">
          {' '}Los permisos y los datos visibles corresponden a ese rol.
        </span>
      </div>
      <button className="btn btn-sm btn-dark flex-shrink-0"
        onClick={handleRetomar} disabled={saliendo}>
        {saliendo
          ? <><span className="spinner-border spinner-border-sm me-1"></span>Retomando...</>
          : <><i className="bi bi-arrow-counterclockwise me-1"></i>Retomar el Rol</>}
      </button>
    </div>
  );
}
