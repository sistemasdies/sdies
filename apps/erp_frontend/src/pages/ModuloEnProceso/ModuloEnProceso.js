import { useLocation } from 'react-router-dom';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';

const MODULO_LABELS = {
  '/procesos/bloquear-fecha':       { titulo: 'Bloquear Fecha',       mod: 'Procesos' },
  '/procesos/cierre-periodo':       { titulo: 'Cierre de Periodo',    mod: 'Procesos' },
  '/procesos/generar-balance':      { titulo: 'Generar Balance',      mod: 'Procesos' },
  '/procesos/generar-presupuesto':  { titulo: 'Generar Presupuesto',  mod: 'Procesos' },
  '/procesos/correccion-datos':     { titulo: 'Corrección de Datos',  mod: 'Procesos' },
  '/procesos/copia-seguridad':      { titulo: 'Copia de Seguridad',   mod: 'Procesos' },
  '/informes/auxiliares':           { titulo: 'Auxiliares',           mod: 'Informes' },
  '/informes/saldos':               { titulo: 'Saldos',               mod: 'Informes' },
  '/informes/balances':             { titulo: 'Balances',             mod: 'Informes' },
  '/informes/estado-presupuestal':  { titulo: 'Estado Presupuestal',  mod: 'Informes' },
};

export default function ModuloEnProceso() {
  const location = useLocation();
  const info = MODULO_LABELS[location.pathname] || { titulo: 'Módulo', mod: '' };
  return (
    <MainLayout>
      <TopBar title={info.titulo} />
      <div className="p-4">
        <PageHeader title={info.titulo} subtitle={`${info.mod} — en construcción`}>
          <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>En preparación</span>
        </PageHeader>
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-cone-striped display-3 d-block mb-3 text-warning"></i>
            <h5>{info.titulo}</h5>
            <p className="mb-0">Este módulo está en construcción. Próximamente estará disponible.</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}