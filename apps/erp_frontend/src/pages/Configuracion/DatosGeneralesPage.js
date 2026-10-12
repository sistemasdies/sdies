import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import SelectorTercero from '../../components/common/SelectorTercero';
import { getDatosGenerales, saveDatosGenerales } from '../../api/datosGenerales';
import { usePerm } from '../../hooks/usePerm';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const CAMPOS_TEXTO = ['NombreOrganizacion', 'NIT', 'direccion', 'telefono', 'email', 'ciudad', 'pais'];

const IMAGENES = [
  { campo: 'LogoDeLaOrganizacion', label: 'Logo de la organización', pista: 'Imagen institucional principal.' },
  { campo: 'logoDeLaApp',          label: 'Logo de la app',          pista: 'Se muestra en el menú lateral.' },
  { campo: 'FondoDeLaApp',         label: 'Fondo de la app',         pista: 'Imagen de fondo de las pantallas.' },
];

export default function DatosGeneralesPage() {
  const { canEdit } = usePerm('/configuracion/datos-generales');
  const { refrescarMarca } = useAuth();

  const [form, setForm]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [presidente, setPresidente] = useState(null);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const [archivos, setArchivos] = useState({});   // campo -> File
  const [quitar, setQuitar]     = useState({});    // campo -> bool
  const [preview, setPreview]   = useState({});    // campo -> objectURL

  const cargar = () => {
    setCargando(true);
    getDatosGenerales()
      .then(({ data }) => {
        setForm(data);
        setPresidente(data.CedulaPresidente
          ? { cedula: data.CedulaPresidente, nombre_completo: data.presidente_nombre }
          : null);
        setArchivos({}); setQuitar({}); setPreview({});
      })
      .catch(() => toast.error('No se pudieron cargar los datos generales'))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const elegirArchivo = (campo, file) => {
    if (!file) return;
    setArchivos(a => ({ ...a, [campo]: file }));
    setQuitar(q => ({ ...q, [campo]: false }));
    setPreview(p => ({ ...p, [campo]: URL.createObjectURL(file) }));
  };

  const marcarQuitar = (campo) => {
    setArchivos(a => { const c = { ...a }; delete c[campo]; return c; });
    setPreview(p => { const c = { ...p }; delete c[campo]; return c; });
    setQuitar(q => ({ ...q, [campo]: true }));
  };

  const guardar = async () => {
    const fd = new FormData();
    CAMPOS_TEXTO.forEach(k => fd.append(k, form[k] || ''));
    fd.append('CedulaPresidente', presidente?.cedula || '');
    Object.entries(archivos).forEach(([campo, file]) => fd.append(campo, file));
    Object.entries(quitar).forEach(([campo, v]) => { if (v) fd.append(campo, ''); });

    try {
      setGuardando(true);
      const { data } = await saveDatosGenerales(fd);
      setForm(data);
      setPresidente(data.CedulaPresidente
        ? { cedula: data.CedulaPresidente, nombre_completo: data.presidente_nombre }
        : null);
      setArchivos({}); setQuitar({}); setPreview({});
      refrescarMarca();
      toast.success('Datos generales guardados');
    } catch (e) {
      const d = e.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.join(' ') : (d || 'Error al guardar los datos generales'));
    } finally {
      setGuardando(false);
    }
  };

  const imagenSrc = (campo) => preview[campo] || form?.[campo] || '';

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
                  } placeholder="Sin asignar" readOnly />
                  <button type="button" className="btn btn-outline-secondary" disabled={!canEdit}
                    onClick={() => setSelectorAbierto(true)}>
                    <i className="bi bi-search"></i>
                  </button>
                  {presidente && (
                    <button type="button" className="btn btn-outline-danger" disabled={!canEdit}
                      onClick={() => setPresidente(null)} title="Quitar">
                      <i className="bi bi-x-lg"></i>
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
              <i className="bi bi-image me-1"></i>Imágenes
            </div>
            <div className="row g-3">
              {IMAGENES.map(({ campo, label, pista }) => (
                <div className="col-md-4" key={campo}>
                  <label className="form-label small mb-1">{label}</label>
                  <div className="border rounded d-flex align-items-center justify-content-center mb-2"
                    style={{ height: 140, background: '#f8f9fa', overflow: 'hidden' }}>
                    {imagenSrc(campo)
                      ? <img src={imagenSrc(campo)} alt={label}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <span className="text-muted small">Sin imagen</span>}
                  </div>
                  <div className="d-flex gap-2">
                    <input type="file" accept="image/*" className="form-control form-control-sm"
                      disabled={!canEdit}
                      onChange={e => elegirArchivo(campo, e.target.files?.[0])} />
                    {(imagenSrc(campo) || quitar[campo]) && canEdit && (
                      <button type="button" className="btn btn-outline-danger btn-sm"
                        onClick={() => marcarQuitar(campo)} title="Quitar imagen">
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
    </MainLayout>
  );
}
