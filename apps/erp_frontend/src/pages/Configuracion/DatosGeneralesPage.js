import { useEffect, useState } from 'react';

import { getDatosGenerales, saveDatosGenerales } from '../../api/datosGenerales';
import CloudinaryPicker from '../../components/common/CloudinaryPicker';
import PageHeader from '../../components/common/PageHeader';
import SelectorTercero from '../../components/common/SelectorTercero';
import Spinner from '../../components/common/Spinner';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import { usePerm } from '../../hooks/usePerm';
import toast from 'react-hot-toast';

const CAMPOS_TEXTO = ['NombreOrganizacion', 'NIT', 'direccion', 'telefono', 'email', 'ciudad', 'pais'];

const IMAGENES = [
  { campo: 'LogoDeLaOrganizacion', label: 'Logo de la organización', tipo: 'logos',  pista: 'Imagen institucional principal.' },
  { campo: 'logoDeLaApp',          label: 'Logo de la app',          tipo: 'logos',  pista: 'Se muestra en el menú lateral.' },
  { campo: 'FondoDeLaApp',         label: 'Fondo de la app',         tipo: 'fondos', pista: 'Imagen de fondo de las pantallas.' },
];

export default function DatosGeneralesPage() {
  const { canEdit } = usePerm('/configuracion/datos-generales');
  const { refrescarMarca } = useAuth();

  const [form, setForm]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [presidente, setPresidente] = useState(null);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [picker, setPicker] = useState(null);   // { campo, tipo }

  const cargar = () => {
    setCargando(true);
    getDatosGenerales()
      .then(({ data }) => {
        setForm(data);
        setPresidente(data.CedulaPresidente
          ? { cedula: data.CedulaPresidente, nombre_completo: data.presidente_nombre }
          : null);
      })
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  const elegirImagen = (url) => {
    set(picker.campo, url);
    setPicker(null);
  };

  const guardar = async () => {
    const payload = {};
    CAMPOS_TEXTO.forEach(k => { payload[k] = form[k] || ''; });
    IMAGENES.forEach(({ campo }) => { payload[campo] = form[campo] || ''; });
    payload.CedulaPresidente = presidente?.cedula || null;

    try {
      setGuardando(true);
      const { data } = await saveDatosGenerales(payload);
      setForm(data);
      setPresidente(data.CedulaPresidente
        ? { cedula: data.CedulaPresidente, nombre_completo: data.presidente_nombre }
        : null);
      refrescarMarca();
      toast.success('Datos generales guardados');
    } catch (e) {
      const d = e.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.join(' ') : (d || 'Error al guardar los datos generales'));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <MainLayout>
        <TopBar title="Datos Generales" />
        <div className="p-5"><Spinner /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <TopBar title="Datos Generales" />
      <div className="p-4">
        <PageHeader title="Datos Generales"
          subtitle="Información de la organización y personalización de la aplicación">
        </PageHeader>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="text-muted small fw-semibold mb-3">
              <i className="bi bi-building me-1"></i>Información de la organización
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small mb-1">Nombre de la organización</label>
                <input className="form-control form-control-sm" disabled={!canEdit}
                  value={form.NombreOrganizacion || ''}
                  onChange={e => set('NombreOrganizacion', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">NIT</label>
                <input className="form-control form-control-sm" disabled={!canEdit}
                  value={form.NIT || ''} onChange={e => set('NIT', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">Teléfono</label>
                <input className="form-control form-control-sm" disabled={!canEdit}
                  value={form.telefono || ''} onChange={e => set('telefono', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label small mb-1">Dirección</label>
                <input className="form-control form-control-sm" disabled={!canEdit}
                  value={form.direccion || ''} onChange={e => set('direccion', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">Ciudad</label>
                <input className="form-control form-control-sm" disabled={!canEdit}
                  value={form.ciudad || ''} onChange={e => set('ciudad', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">País</label>
                <input className="form-control form-control-sm" disabled={!canEdit}
                  value={form.pais || ''} onChange={e => set('pais', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label small mb-1">Email</label>
                <input type="email" className="form-control form-control-sm" disabled={!canEdit}
                  value={form.email || ''} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label small mb-1">Presidente</label>
                <div className="input-group input-group-sm">
                  <input className="form-control" disabled value={
                    presidente ? `${presidente.cedula} - ${presidente.nombre_completo}` : ''
                  } />
                  <button type="button" className="btn btn-outline-secondary" disabled={!canEdit}
                    onClick={() => setSelectorAbierto(true)}>
                    <i className="bi bi-search"></i>
                  </button>
                  {presidente && (
                    <button type="button" className="btn btn-outline-danger" disabled={!canEdit}
                      onClick={() => setPresidente(null)} title="Quitar presidente">
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="text-muted small fw-semibold mb-3">
              <i className="bi bi-cloud me-1"></i>Imágenes (Cloudinary)
            </div>
            <div className="row g-3">
              {IMAGENES.map(({ campo, label, tipo, pista }) => (
                <div className="col-md-4" key={campo}>
                  <label className="form-label small mb-1">{label}</label>
                  <div className="border rounded d-flex align-items-center justify-content-center mb-2"
                    style={{ height: 140, background: '#f8f9fa', overflow: 'hidden' }}>
                    {form[campo]
                      ? <img src={form[campo]} alt={label}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <span className="text-muted small">Sin imagen</span>}
                  </div>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-outline-success btn-sm"
                      disabled={!canEdit}
                      onClick={() => setPicker({ campo, tipo })}>
                      <i className="bi bi-cloud-arrow-down me-1"></i>Elegir de Cloudinary
                    </button>
                    {form[campo] && canEdit && (
                      <button type="button" className="btn btn-outline-danger btn-sm"
                        onClick={() => set(campo, '')} title="Quitar imagen">
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </div>
                  <div className="form-text">{pista}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="d-flex justify-content-end">
            <button className="btn btn-success" onClick={guardar} disabled={guardando}>
              {guardando
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                : <><i className="bi bi-save me-1"></i>Guardar</>}
            </button>
          </div>
        )}
      </div>

      <SelectorTercero
        abierto={selectorAbierto}
        onCerrar={() => setSelectorAbierto(false)}
        onElegir={(item) => setPresidente({ cedula: item.cedula, nombre_completo: item.nombre_completo })}
        cedulaInicial={presidente?.cedula}
      />

      <CloudinaryPicker
        abierto={!!picker}
        tipo={picker?.tipo}
        onCerrar={() => setPicker(null)}
        onElegir={elegirImagen}
      />
    </MainLayout>
  );
}
