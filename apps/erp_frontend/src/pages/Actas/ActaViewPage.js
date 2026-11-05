import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from '../../components/common/Spinner';
import { getActa } from '../../api/actas';
import toast from 'react-hot-toast';

const ESTADOS = {
  '1': 'Borrador',
  '2': 'Revisada',
  '3': 'Firmada',
  '4': 'Archivada',
};

export default function ActaViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [acta, setActa] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActa(id)
      .then(r => setActa(r.data))
      .catch(() => toast.error('Error al cargar el acta'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <Spinner />
      </div>
    );
  }

  if (!acta) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="alert alert-danger">No encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light py-4">
      <div className="container">
        <div className="no-print d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">Vista previa del acta</h4>
          <div className="btn-group">
            <button className="btn btn-outline-primary" onClick={handlePrint}>
              <i className="bi bi-printer me-1"></i>Imprimir
            </button>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/secretaria/actas')}>
              <i className="bi bi-arrow-left me-1"></i>Volver
            </button>
          </div>
        </div>

        <div className="card shadow-sm p-4 acta-print">
          <div className="text-center mb-4">
            <h3 className="fw-bold">{acta.titulo}</h3>
            <p className="text-muted mb-1">{acta.congregacion_nombre} · Acta #{acta.codigo}</p>
            <p className="text-muted">{acta.tipo} · {acta.fecha_reunion}</p>
            <span className="badge bg-secondary">{ESTADOS[acta.estado]}</span>
          </div>

          <div className="acta-contenido mb-4" dangerouslySetInnerHTML={{ __html: acta.contenido }} />

          <div className="mt-5">
            <h6 className="fw-bold">Firmas:</h6>
            {acta.firmas?.length === 0
              ? <p className="text-muted">Sin firmas registradas</p>
              : (
                <div className="row g-3">
                  {acta.firmas.map(f => (
                    <div key={f.id} className="col-md-4">
                      <div className="border-bottom pb-2">
                        <div className="fw-semibold">{f.nombre}</div>
                        <small className="text-muted">
                          {f.tipo_firma} · {f.fecha_firma ? new Date(f.fecha_firma).toLocaleString() : 'Pendiente'}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .card { box-shadow: none !important; border: none !important; }
        }
      `}</style>
    </div>
  );
}
