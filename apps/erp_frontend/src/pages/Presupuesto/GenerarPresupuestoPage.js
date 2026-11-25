import { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import MultiSelect from '../../components/common/MultiSelect';
import { usePerm } from '../../hooks/usePerm';
import {
  getPresupuestos, updatePresupuesto, deletePresupuesto,
  generarPresupuesto, reiniciarPresupuesto,
} from '../../api/presupuesto';
import { getCentrosCosto } from '../../api/centrosCosto';
import { formatMoney } from '../../utils/formato';
import toast from 'react-hot-toast';

const ANIO_ACTUAL = new Date().getFullYear();

export default function GenerarPresupuestoPage() {
  const { canAdd, canEdit, canDel } = usePerm(window.location.pathname);

  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [porcentajeIncremento, setPorcentajeIncremento] = useState(0);
  const [fechaDesde, setFechaDesde] = useState(`${ANIO_ACTUAL - 1}-01-01`);
  const [fechaHasta, setFechaHasta] = useState(`${ANIO_ACTUAL - 1}-12-31`);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [seleccionCC, setSeleccionCC] = useState([]);
  const [mostrarRegistrosEnCero, setMostrarRegistrosEnCero] = useState(true);

  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);

  const presupuestosFiltrados = mostrarRegistrosEnCero
    ? presupuestos
    : presupuestos.filter(p => parseFloat(p.monto_mensual) !== 0);

  useEffect(() => {
    getCentrosCosto({ page_size: 1000 })
      .then(r => {
        const lista = r.data.results || r.data || [];
        setCentrosCosto(lista.filter(c => c.is_active));
      })
      .catch(() => {});
  }, []);

  const cargar = useCallback(() => {
    setLoading(true);
    getPresupuestos({ anio, page_size: 10000 })
      .then(r => setPresupuestos(r.data.results || r.data || []))
      .catch(() => toast.error('No se pudo cargar el presupuesto'))
      .finally(() => setLoading(false));
  }, [anio]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGenerar = async () => {
    if (!window.confirm(`¿Generar presupuesto para el año ${anio}? Esto reemplazará el presupuesto existente.`)) return;
    setGenerando(true);
    try {
      await generarPresupuesto({
        anio,
        porcentaje_incremento: parseFloat(porcentajeIncremento) || 0,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        centros_costo: seleccionCC,
      });
      toast.success('Presupuesto generado correctamente');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar presupuesto');
    } finally {
      setGenerando(false);
    }
  };

  const handleReiniciar = async () => {
    if (!window.confirm(`¿Borrar todo el presupuesto del año ${anio}?`)) return;
    try {
      await reiniciarPresupuesto({ anio });
      toast.success('Presupuesto reiniciado');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al reiniciar');
    }
  };

  const guardarMonto = async (id, valor) => {
    try {
      await updatePresupuesto(id, { monto_mensual: valor });
      toast.success('Monto actualizado');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    try {
      await deletePresupuesto(id);
      toast.success('Registro eliminado');
      cargar();
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  return (
    <MainLayout>
      <TopBar title="Generar Presupuesto" />
      <div className="p-4">
        <PageHeader title="Generar Presupuesto" subtitle="Presupuesto mensual por cuenta y centro de costo">
          {canAdd && (
            <button className="btn btn-success btn-sm" onClick={handleGenerar} disabled={generando}>
              {generando ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-magic me-2"></i>}
              Generar desde histórico
            </button>
          )}
        </PageHeader>

        <div className="row g-3 mb-3 align-items-end">
          <div className="col-md-1">
            <label className="form-label small fw-semibold">Año destino</label>
            <input type="number" className="form-control form-control-sm" value={anio} min="2000" max="2100"
              onChange={e => setAnio(parseInt(e.target.value, 10) || ANIO_ACTUAL)} />
          </div>
          <div className="col-md-1">
            <label className="form-label small fw-semibold">% Incremento</label>
            <input type="number" className="form-control form-control-sm" value={porcentajeIncremento} min="-100" max="1000" step="0.01"
              onChange={e => setPorcentajeIncremento(e.target.value)} />
          </div>
          <div className="col-md-2" style={{ flex: '0 0 11.67%', maxWidth: '11.67%' }}>
            <label className="form-label small fw-semibold">Desde (histórico)</label>
            <input type="date" className="form-control form-control-sm" value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)} />
          </div>
          <div className="col-md-2" style={{ flex: '0 0 11.67%', maxWidth: '11.67%' }}>
            <label className="form-label small fw-semibold">Hasta (histórico)</label>
            <input type="date" className="form-control form-control-sm" value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Centros de costo</label>
            <MultiSelect
              options={centrosCosto}
              value={seleccionCC}
              onChange={setSeleccionCC}
              getKey={c => c.codigo}
              getLabel={c => `${c.codigo} - ${c.descripcion}`}
              placeholder="Todos los centros de costo" />
          </div>
          <div className="col-md-auto">
            <div className="form-check mb-2">
              <input className="form-check-input" type="checkbox" id="chkCeros"
                checked={mostrarRegistrosEnCero}
                onChange={e => setMostrarRegistrosEnCero(e.target.checked)} />
              <label className="form-check-label small" htmlFor="chkCeros">Mostrar registros en cero</label>
            </div>
            {canDel && (
              <button className="btn btn-outline-danger btn-sm" onClick={handleReiniciar}>
                <i className="bi bi-trash me-1"></i>Reiniciar año
              </button>
            )}
          </div>
        </div>

        {loading ? <div className="py-5"><Spinner /></div>
          : presupuestosFiltrados.length === 0 ? (
            <EmptyState icon="bi-calculator" title="Sin presupuesto" subtitle="Genere el presupuesto desde el histórico o créelo manualmente" />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle">
                  <thead className="table-dark">
                    <tr style={{ fontSize: '0.75rem' }}>
                      <th style={{ width: '1%' }}>Cuenta</th>
                      <th style={{ width: '1%' }}>Centro de costo</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Descripción</th>
                      <th className="text-end" style={{ width: '1%' }}>Monto mensual</th>
                      <th className="text-end" style={{ width: '1%' }}>Presupuesto anual</th>
                      <th className="text-center" style={{ width: '1%' }}>Acciones</th>
                      <th style={{ width: '100%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(
                      presupuestosFiltrados.reduce((grupos, p) => {
                        const key = p.cuenta_codigo;
                        if (!grupos[key]) {
                          grupos[key] = { cuenta: p.cuenta_codigo, nombre: p.cuenta_nombre, items: [], totalMensual: 0, totalAnual: 0 };
                        }
                        grupos[key].items.push(p);
                        grupos[key].totalMensual += parseFloat(p.monto_mensual) || 0;
                        grupos[key].totalAnual += (parseFloat(p.monto_mensual) || 0) * 12;
                        return grupos;
                      }, {})
                    ).map(grupo => (
                      <>
                        <tr key={grupo.cuenta} className="table-light fw-semibold">
                          <td className="py-2"><code>{grupo.cuenta}</code></td>
                          <td></td>
                          <td className="py-2" style={{ whiteSpace: 'nowrap' }}>{grupo.nombre}</td>
                          <td className="text-end">{formatMoney(grupo.totalMensual)}</td>
                          <td className="text-end">{formatMoney(grupo.totalAnual)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                        {grupo.items.map(p => (
                          <tr key={p.id}>
                            <td></td>
                            <td style={{ whiteSpace: 'nowrap' }} className="small text-end">
                              <code>{p.centro_costo_codigo}</code>
                            </td>
                            <td className="small" style={{ whiteSpace: 'nowrap' }}>{p.centro_costo_nombre}</td>
                            <td className="text-end">
                              {canEdit ? (
                                <MontoEditable valor={p.monto_mensual} onGuardar={v => guardarMonto(p.id, v)} />
                              ) : (
                                formatMoney(p.monto_mensual)
                              )}
                            </td>
                            <td className="text-end">{formatMoney((parseFloat(p.monto_mensual) || 0) * 12)}</td>
                            <td className="text-center">
                              {canDel && (
                                <button className="btn btn-sm btn-outline-danger" onClick={() => eliminar(p.id)}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </td>
                            <td></td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="small text-muted">{presupuestosFiltrados.length} registro(s) mostrado(s) de {presupuestos.length}</div>
            </>
          )}
      </div>
    </MainLayout>
  );
}

function MontoEditable({ valor, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [nuevo, setNuevo] = useState(valor);

  useEffect(() => { setNuevo(valor); }, [valor]);

  const guardar = () => {
    onGuardar(nuevo);
    setEditando(false);
  };

  if (!editando) {
    return (
      <span style={{ cursor: 'pointer' }} onClick={() => setEditando(true)}>
        {formatMoney(valor)}
      </span>
    );
  }

  return (
    <div className="input-group input-group-sm justify-content-end">
      <input type="number" className="form-control text-end" style={{ maxWidth: '140px' }}
        value={nuevo} onChange={e => setNuevo(e.target.value)} step="0.01" />
      <button className="btn btn-success" onClick={guardar}><i className="bi bi-check"></i></button>
      <button className="btn btn-secondary" onClick={() => { setNuevo(valor); setEditando(false); }}><i className="bi bi-x"></i></button>
    </div>
  );
}
