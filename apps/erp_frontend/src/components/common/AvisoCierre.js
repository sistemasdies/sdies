import { useEffect, useState } from 'react';
import API from '../../api/client';
import { formatDate } from '../../utils/formato';

export default function AvisoCierre() {
  const [fecha, setFecha] = useState(null);

  useEffect(() => {
    let activo = true;
    API.get('/users/me/')
      .then(r => { if (activo) setFecha(r.data?.fecha_cierre || null); })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  if (!fecha) return null;
  return (
    <div className="alert alert-warning d-flex align-items-start gap-2 py-2">
      <i className="bi bi-exclamation-triangle-fill mt-1"></i>
      <div>
        Su fecha de cierre es <strong>{formatDate(fecha)}</strong>: no puede adicionar,
        modificar ni eliminar movimientos contables con fecha igual o anterior a ella.
      </div>
    </div>
  );
}