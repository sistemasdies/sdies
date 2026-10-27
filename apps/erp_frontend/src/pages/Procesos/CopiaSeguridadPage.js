import { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import { exportarBackup, importarBackup } from '../../api/backup';
import { useAuth } from '../../context/AuthContext';

const detalleError = async (e, porDefecto) => {
  const data = e.response?.data;
  if (data instanceof Blob) {
    try {
      const texto = await data.text();
      try { return JSON.parse(texto)?.detail || texto || porDefecto; }
      catch { return texto || porDefecto; }
    } catch {
      return porDefecto;
    }
  }
  return data?.detail || porDefecto;
};

export default function CopiaSeguridadPage() {
  const { user } = useAuth();
  const esSuperusuario = !!user?.is_superuser;
  const [includeMedia, setIncludeMedia] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const handleExport = async () => {
    try {
      setExportando(true);
      setMensaje('');
      setError('');
      const res = await exportarBackup({ incluir_media: includeMedia ? 'true' : 'false' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/gzip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dispo = res.headers['content-disposition'] || '';
      let fname = includeMedia ? 'sdies_backup_completo.zip' : 'sdies_backup.sql.gz';
      const m = dispo.match(/filename="?([^"]+)"?/);
      if (m) fname = m[1];
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMensaje(`Copia descargada: ${fname}`);
    } catch (e) {
      setError(await detalleError(e, 'Error al exportar la copia de seguridad'));
    } finally {
      setExportando(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!archivo) return setError('Selecciona un archivo .sql, .sql.gz o .zip');
    if (confirm !== 'CONFIRMAR') return setError('Debes escribir CONFIRMAR para proceder');
    const formData = new FormData();
    formData.append('archivo', archivo);
    try {
      setImportando(true);
      setMensaje('');
      setError('');
      const res = await importarBackup(formData);
      setMensaje(res.data?.detail || 'Restauración completada con éxito');
      setArchivo(null);
      setConfirm('');
    } catch (e) {
      setError(await detalleError(e, 'Error al restaurar la copia de seguridad'));
    } finally {
      setImportando(false);
    }
  };

  return (
    <MainLayout>
      <TopBar title="Copia de Seguridad" />
      <div className="p-4">
        <PageHeader title="Copia de Seguridad"
          subtitle="Procesos — Copia y restauración de PostgreSQL">
          <span className="badge bg-secondary"><i className="bi bi-database me-1"></i>Respaldos</span>
        </PageHeader>

        {!esSuperusuario && (
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Solo el superusuario puede exportar o importar copias de seguridad.
            {user?.rol_activo && (
              <span className="d-block mt-1 small">
                Está usando el rol <strong>{user.rol_activo.nombre}</strong>;
                retome su rol para habilitar esta opción.
              </span>
            )}
          </div>
        )}

        {mensaje && <div className="alert alert-success">{mensaje}</div>}
        {error && (
          <div className="alert alert-danger" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>
        )}

        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0">
                <h6 className="mb-0">Exportar (crear copia)</h6>
              </div>
              <div className="card-body">
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" id="media"
                    checked={includeMedia} onChange={e => setIncludeMedia(e.target.checked)}
                    disabled={!esSuperusuario} />
                  <label className="form-check-label" htmlFor="media">
                    Incluir archivos multimedia (media/) en un .zip
                  </label>
                </div>
                <p className="text-muted small mb-3">
                  Se descarga un archivo <code>.sql.gz</code> con el esquema y todos los
                  datos de PostgreSQL. Si marca la opción, se descarga un <code>.zip</code>
                  que contiene la copia y la carpeta <code>media/</code>.
                </p>
                <button className="btn btn-primary" onClick={handleExport}
                  disabled={!esSuperusuario || exportando}>
                  {exportando
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Generando copia...</>
                    : <><i className="bi bi-download me-2"></i>Descargar copia de seguridad</>}
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0">
                <h6 className="mb-0">Restaurar (importar copia)</h6>
              </div>
              <div className="card-body">
                <div className="alert alert-danger small mb-3">
                  <strong>¡ATENCIÓN!</strong> Esto reemplaza todas las tablas y datos
                  actuales. La restauración es atómica: si falla, no se aplica ningún
                  cambio. No uses el sistema mientras se restaura.
                </div>
                <form onSubmit={handleImport}>
                  <div className="mb-3">
                    <label className="form-label">Archivo</label>
                    <input type="file" className="form-control"
                      accept=".sql,.gz,.sql.gz,.zip"
                      onChange={e => setArchivo(e.target.files[0] || null)}
                      disabled={!esSuperusuario} />
                    <div className="form-text">
                      Acepta <code>.sql</code>, <code>.sql.gz</code> o <code>.zip</code>.
                      Si es un <code>.zip</code>, se restaura solo la base de datos.
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      Escribe <strong>CONFIRMAR</strong> para habilitar la restauración
                    </label>
                    <input type="text" className="form-control" value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      disabled={!esSuperusuario} placeholder="CONFIRMAR" />
                  </div>
                  <button type="submit" className="btn btn-danger"
                    disabled={!esSuperusuario || importando || confirm !== 'CONFIRMAR' || !archivo}>
                    {importando
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Restaurando...</>
                      : <><i className="bi bi-upload me-2"></i>Restaurar base de datos</>}
                  </button>
                </form>
                <hr className="my-3" />
                <p className="text-muted small mb-0">
                  <strong>Para restaurar en su equipo local:</strong> genere la copia en
                  este servidor, abra el sistema local y súbala aquí mismo. También puede
                  usar <code>psql -U postgres -d sdies -f copia.sql</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
