import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getActaPorToken, firmarConToken } from '../../api/actas';
import toast from 'react-hot-toast';

const ESTADOS = {
  '1': 'Borrador',
  '2': 'Revisada',
  '3': 'Firmada',
  '4': 'Archivada',
};

export default function FirmaPublicaPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmacionDoc, setConfirmacionDoc] = useState('');
  const [firmando, setFirmando] = useState(false);
  const [firmada, setFirmada] = useState(false);

  useEffect(() => {
    getActaPorToken(token)
      .then(r => setData(r.data))
      .catch(() => toast.error('Enlace inválido o expirado'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleFirmar = async () => {
    setFirmando(true);
    try {
      await firmarConToken(token, confirmacionDoc);
      toast.success('Acta firmada correctamente');
      setFirmada(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al firmar');
    } finally {
      setFirmando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="spinner-border text-success"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="alert alert-danger">Enlace inválido o expirado</div>
      </div>
    );
  }

  const { acta, firmante, expira } = data;

  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container">
        <div className="card shadow-sm">
          <div className="card-header bg-success text-white">
            <h4 className="mb-0"><i className="bi bi-file-text me-2"></i>Firma de Acta</h4>
          </div>
          <div className="card-body">
            <div className="text-center mb-4">
              <h3 className="fw-bold">{acta.titulo}</h3>
              <p className="text-muted mb-1">{acta.congregacion_nombre} · Acta #{acta.codigo}</p>
              <p className="text-muted">{acta.tipo} · {acta.fecha_reunion}</p>
              <span className="badge bg-secondary">{ESTADOS[acta.estado]}</span>
            </div>

            <div className="mb-4 p-3 border rounded bg-white acta-contenido"
              dangerouslySetInnerHTML={{ __html: acta.contenido }} />

            <div className="alert alert-light border">
              <strong>Firmante:</strong> {firmante}<br />
              <strong>Enlace expira:</strong> {new Date(expira).toLocaleString()}
            </div>

            {firmada ? (
              <div className="alert alert-success">
                <i className="bi bi-check-circle me-2"></i>
                Has firmado esta acta correctamente.
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <label className="form-label">Confirmación de documento (opcional)</label>
                  <input className="form-control" maxLength={30}
                    value={confirmacionDoc} onChange={e => setConfirmacionDoc(e.target.value)}
                    placeholder="Últimos dígitos de tu documento" />
                </div>
                <button className="btn btn-success w-100" onClick={handleFirmar} disabled={firmando}>
                  {firmando
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Firmando...</>
                    : <><i className="bi bi-pen me-2"></i>Firmar acta</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
