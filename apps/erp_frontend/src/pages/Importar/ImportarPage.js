import { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import ImportadorCuentas           from './ImportadorCuentas';
import ImportadorTerceros          from './ImportadorTerceros';
import ImportadorCentrosCosto      from './ImportadorCentrosCosto';
import ImportadorComprobantes      from './ImportadorComprobantes';
import ImportadorPlantillas        from './ImportadorPlantillas';
import ImportadorDetallePlantillas from './ImportadorDetallePlantillas';
import ImportadorMoviCont          from './ImportadorMoviCont';

const MODULOS = [
  { id: 'cuentas',          label: 'Plan de Cuentas',       icon: 'bi-diagram-3',    color: 'success' },
  { id: 'terceros',         label: 'Terceros',               icon: 'bi-people',       color: 'primary' },
  { id: 'centros_costo',    label: 'Centros de Costo',       icon: 'bi-bullseye',     color: 'warning' },
  { id: 'comprobantes',     label: 'Comprobantes',           icon: 'bi-receipt',      color: 'info'    },
  { id: 'movicont',         label: 'Movimientos (MoviCont)', icon: 'bi-journal-arrow-up', color: 'success' },
  { id: 'plantillas',       label: 'Títulos de Plantillas',  icon: 'bi-journals',     color: 'success' },
  { id: 'det_plantillas',   label: 'Detalles de Plantillas', icon: 'bi-list-ul',      color: 'primary' },
];

export default function ImportarPage() {
  const [activo, setActivo] = useState('cuentas');

  return (
    <MainLayout>
      <TopBar title="Importar Datos" />
      <div className="p-4">
        <PageHeader title="Importar Datos"
          subtitle="Carga masiva desde archivos CSV" />

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-2">
            <div className="d-flex gap-2 flex-wrap">
              {MODULOS.map(m => (
                <button key={m.id}
                  className={`btn btn-${activo===m.id?m.color:'outline-'+m.color} d-flex align-items-center gap-2`}
                  onClick={() => setActivo(m.id)}>
                  <i className={`bi ${m.icon}`}></i>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activo === 'cuentas'        && <ImportadorCuentas />}
        {activo === 'terceros'       && <ImportadorTerceros />}
        {activo === 'centros_costo'  && <ImportadorCentrosCosto />}
        {activo === 'comprobantes'   && <ImportadorComprobantes />}
        {activo === 'movicont'       && <ImportadorMoviCont />}
        {activo === 'plantillas'     && <ImportadorPlantillas />}
        {activo === 'det_plantillas' && <ImportadorDetallePlantillas />}
      </div>
    </MainLayout>
  );
}