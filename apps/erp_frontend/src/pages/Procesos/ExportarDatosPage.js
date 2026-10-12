import { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import { exportarEntidad, exportarTodo } from '../../api/exportarDatos';
import toast from 'react-hot-toast';

const MODULOS = [
  { id: 'cuentas',        label: 'Plan de Cuentas',        icon: 'bi-diagram-3',        color: 'success', desc: 'codigo, descripcion' },
  { id: 'terceros',       label: 'Terceros',               icon: 'bi-people',           color: 'primary', desc: 'Datos completos del tercero' },
  { id: 'centros_costo',  label: 'Centros de Costo',       icon: 'bi-bullseye',         color: 'warning', desc: 'codigo, descripcion, responsable' },
  { id: 'comprobantes',   label: 'Comprobantes',           icon: 'bi-receipt',          color: 'info',    desc: 'codigo, descripcion, numero inicial, activo' },
  { id: 'movicont',       label: 'Movimientos (MoviCont)', icon: 'bi-journal-arrow-up', color: 'success', desc: '12 columnas de MoviCont' },
  { id: 'plantillas',     label: 'Títulos de Plantillas',  icon: 'bi-journals',         color: 'success', desc: 'cod_plantilla, nombre, descripcion, comprobante' },
  { id: 'det_plantillas', label: 'Detalles de Plantillas', icon: 'bi-list-ul',          color: 'primary', desc: '12 columnas de detalle' },
];

const descargar = (data, res, nombreDefault) => {
  const blob = new Blob([data], {
    type: res.headers['content-type'] || 'application/octet-stream',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dispo = res.headers['content-disposition'] || '';
  const m = dispo.match(/filename="?([^"]+)"?/);
  a.download = m ? m[1] : nombreDefault;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export default function ExportarDatosPage() {
  const [cargando, setCargando] = useState(null);

  const handleEntidad = async (mod) => {
    try {
      setCargando(mod.id);
      const res = await exportarEntidad(mod.id);
      descargar(res.data, res, `${mod.id}.csv`);
      toast.success(`${mod.label} exportado`);
    } catch (e) {
      toast.error(e.response?.data?.detail || `Error al exportar ${mod.label}`);
    } finally {
      setCargando(null);
    }
  };

  const handleTodo = async () => {
    try {
      setCargando('__todo__');
      const res = await exportarTodo();
      descargar(res.data, res, 'exportar_datos.zip');
      toast.success('Todos los datos exportados');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al exportar los datos');
    } finally {
      setCargando(null);
    }
  };

  return (
    <MainLayout>
      <TopBar title="Exportar Datos" />
      <div className="p-4">
        <PageHeader title="Exportar Datos"
          subtitle="Descarga masiva a CSV — mismo formato que la importación">
          <button className="btn btn-success" onClick={handleTodo}
            disabled={cargando !== null}>
            {cargando === '__todo__'
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Generando...</>
              : <><i className="bi bi-file-earmark-zip me-2"></i>Exportar todo (ZIP)</>}
          </button>
        </PageHeader>

        <div className="alert alert-info border-0">
          <i className="bi bi-info-circle me-2"></i>
          Los archivos CSV usan las mismas columnas y orden que las plantillas de
          <strong> Importar Datos</strong>, por lo que se pueden volver a importar sin cambios.
        </div>

        <div className="row g-3">
          {MODULOS.map(mod => (
            <div key={mod.id} className="col-md-6 col-xl-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <span className={`badge bg-${mod.color} rounded-circle p-3`}>
                      <i className={`bi ${mod.icon} fs-5`}></i>
                    </span>
                    <div>
                      <div className="fw-semibold">{mod.label}</div>
                      <div className="text-muted small">{mod.desc}</div>
                    </div>
                  </div>
                  <button
                    className={`btn btn-outline-${mod.color} mt-auto`}
                    onClick={() => handleEntidad(mod)}
                    disabled={cargando !== null}>
                    {cargando === mod.id
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Exportando...</>
                      : <><i className="bi bi-download me-2"></i>Exportar CSV</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
