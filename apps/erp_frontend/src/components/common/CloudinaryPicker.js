import { useEffect, useState } from 'react';
import { listarImagenesCloudinary } from '../../api/datosGenerales';
import Spinner from './Spinner';

/**
 * Selector de imágenes alojadas en una carpeta de Cloudinary.
 * `tipo` es 'logos' o 'fondos'.
 */
export default function CloudinaryPicker({ abierto, tipo, onCerrar, onElegir }) {
  const [cargando, setCargando] = useState(false);
  const [imagenes, setImagenes] = useState([]);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    setError('');
    setImagenes([]);
    listarImagenesCloudinary(tipo)
      .then(({ data }) => setImagenes(data.imagenes || []))
      .catch(e => setError(e.response?.data?.detail || 'No se pudieron cargar las imágenes'))
      .finally(() => setCargando(false));
  }, [abierto, tipo]);

  if (!abierto) return null;

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="bi bi-cloud-arrow-down me-2"></i>
              Elegir imagen · {tipo}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onCerrar}></button>
          </div>
          <div className="modal-body">
            {cargando && <div className="p-4"><Spinner /></div>}
            {!cargando && error && (
              <div className="alert alert-danger small mb-0">{error}</div>
            )}
            {!cargando && !error && imagenes.length === 0 && (
              <div className="text-muted small text-center py-4">
                No hay imágenes en la carpeta <code>{tipo}</code> de Cloudinary.
              </div>
            )}
            {!cargando && !error && imagenes.length > 0 && (
              <div className="row g-3">
                {imagenes.map(img => (
                  <div className="col-6 col-md-4 col-lg-3" key={img.public_id}>
                    <button type="button"
                      className="btn p-0 border rounded w-100 h-100 text-start"
                      onClick={() => onElegir(img.url)}>
                      <img src={img.url} alt={img.filename}
                        style={{ width: '100%', height: 110, objectFit: 'cover', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                      <div className="small text-truncate px-1 py-1">{img.filename}</div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
