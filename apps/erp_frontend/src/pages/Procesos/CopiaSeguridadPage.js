import { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import { exportarBackup, importarBackup } from '../../api/backup';
import { useAuth } from '../../context/AuthContext';

export default function CopiaSeguridadPage() {
  const { user } = useAuth();
  const isSuperuser = user?.is_superuser || user?.is_staff;
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
      let fname = 'sdies_backup.sql.gz';
      const m = dispo.match(/filename="?([^"]+)"?/);
      if (m) fname = m[1];
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMensaje('Copia de seguridad descargada correctamente.');
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al exportar copia de seguridad');
    } finally {
      setExportando(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!archivo) return setError('Selecciona un archivo .sql o .sql.gz');
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
      setError(e.response?.data?.detail || 'Error al restaurar copia de seguridad');
    } finally {
      setImportando(false);
    }
  };

  return (
    <MainLayout>
      <TopBar title="Copia de Seguridad" />
      <div className="p-4">
        <PageHeader title="Copia de Seguridad" subtitle="Procesos — Base de datos PostgreSQL">
          <span className="badge bg-secondary"><i className="bi bi-database me-1"></i>Respaldos</span>
        </PageHeader>

        {!isSuperuser && (
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2"></i>Solo usuarios superusuario pueden exportar/importar copias de seguridad.
          </div>
        )}

        {mensaje && <div className="alert alert-success">{mensaje}</div>}
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0"><h6 className="mb-0">Exportar (Crear copia)</h6></div>
              <div className="card-body">
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" id="media" checked={includeMedia} onChange={e => setIncludeMedia(e.target.checked)} disabled={!isSuperuser} />
                  <label className="form-check-label" htmlFor="media">Incluir archivos multimedia (media/) — descarga aparte</label>
                </div>
                <p className="text-muted small mb-3">Se genera siempre un archivo <code>.sql.gz</code> con el esquema y datos de PostgreSQL. Si marcas la opción, se generará también <code>.tar.gz</code> con los archivos de <code>media/</code>.</p>
                <button className="btn btn-primary" onClick={handleExport} disabled={!isSuperuser || exportando}>
                  {exportando ? 'Generando...' : <><i className="bi bi-download me-2"></i>Descargar copia de seguridad</>}
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0"><h6 className="mb-0">Restaurar (Importar copia)</h6></div>
              <div className="card-body">
                <div className="alert alert-danger small mb-3">
                  <strong>¡ATENCIÓN!</strong> ESTO SOBRESCRIBIRÁ TODOS LOS DATOS ACTUALES. Usa <code>--single-transaction</code>; si falla, se revierte.
                </div>
                <form onSubmit={handleImport}>
                  <div className="mb-3">
                    <label className="form-label">Archivo</label>
                    <input type="file" className="form-control" accept=".sql,.gz,.sql.gz" onChange={e => setArchivo(e.target.files[0])} disabled={!isSuperuser} />
                    <div className="form-text">Acepta <code>.sql</code> o <code>.sql.gz</code></div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Escribe <strong>CONFIRMAR</strong> para habilitar la restauración</label>
                    <input type="text" className="form-control" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={!isSuperuser} placeholder="CONFIRMAR" />
                  </div>
                  <button type="submit" className="btn btn-danger" disabled={!isSuperuser || importando || confirm !== 'CONFIRMAR' || !archivo}>
                    {importando ? 'Restaurando...' : <><i className="bi bi-upload me-2"></i>Restaurar base de datos</>}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
