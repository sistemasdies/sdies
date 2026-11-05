import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../../components/layout/MainLayout';
import TopBar from '../../components/layout/TopBar';
import PageHeader from '../../components/common/PageHeader';
import Spinner from '../../components/common/Spinner';
import RichTextEditor from '../../components/common/RichTextEditor';
import { getActa, createActa, updateActa, getSiguienteCodigo, enviarFirmas, firmarActa, cambiarEstadoActa } from '../../api/actas';
import { getCongregaciones } from '../../api/congregaciones';
import { getMembresias } from '../../api/membresias';
import { getUsers } from '../../api/users';
import toast from 'react-hot-toast';

const ESTADOS = [
  { value: '1', label: 'Borrador' },
  { value: '2', label: 'Revisada' },
  { value: '3', label: 'Firmada' },
  { value: '4', label: 'Archivada' },
];

const FORM_VACIO = {
  congregacion: '',
  codigo: '',
  titulo: '',
  tipo: '',
  fecha_reunion: '',
  contenido: '',
  estado: '1',
};

export default function ActaFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(FORM_VACIO);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [congregaciones, setCongregaciones] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [seleccionFirmas, setSeleccionFirmas] = useState({ miembros: [], usuarios: [] });
  const [busquedaMiembro, setBusquedaMiembro] = useState('');
  const [passwordFirma, setPasswordFirma] = useState('');
  const [firmas, setFirmas] = useState([]);

  useEffect(() => {
    getCongregaciones({ page_size: 10000 })
      .then(r => setCongregaciones(r.data.results || r.data))
      .catch(() => {});
    getMembresias({ page_size: 10000 })
      .then(r => setMiembros(r.data.results || r.data))
      .catch(() => {});
    getUsers()
      .then(r => setUsuarios(r.data.results || r.data))
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const r = await getActa(id);
      const a = r.data;
      setForm({
        congregacion: a.congregacion,
        codigo: a.codigo,
        titulo: a.titulo,
        tipo: a.tipo,
        fecha_reunion: a.fecha_reunion,
        contenido: a.contenido,
        estado: a.estado,
      });
      setFirmas(a.firmas || []);
    } catch (err) {
      toast.error('Error al cargar el acta');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => { cargar(); }, [cargar]);

  const generarCodigo = async () => {
    if (!form.congregacion) {
      toast.error('Seleccione una congregación');
      return;
    }
    try {
      const r = await getSiguienteCodigo(form.congregacion);
      setForm(f => ({ ...f, codigo: r.data.siguiente_codigo }));
    } catch (err) {
      toast.error('Error al generar código');
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit) {
        await updateActa(id, payload);
        toast.success('Acta actualizada');
      } else {
        await createActa(payload);
        toast.success('Acta creada');
        navigate('/secretaria/actas');
      }
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarFirmas = async () => {
    try {
      const r = await enviarFirmas(id, seleccionFirmas);
      const { enviados, errores } = r.data;
      if (enviados > 0) {
        toast.success(`${enviados} correo(s) enviado(s)`);
      }
      if (errores?.length > 0) {
        errores.forEach(e => toast.error(`${e.miembro || e.usuario || 'Persona'}: ${e.error}`));
      }
      if (enviados === 0 && (!errores || errores.length === 0)) {
        toast.error('No se seleccionaron personas con correo válido');
      }
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar firmas');
    }
  };

  const handleFirmarYo = async () => {
    try {
      await firmarActa(id, passwordFirma);
      toast.success('Acta firmada');
      setPasswordFirma('');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al firmar');
    }
  };

  const handleCambiarEstado = async (estado) => {
    try {
      await cambiarEstadoActa(id, estado);
      toast.success('Estado actualizado');
      cargar();
    } catch (err) {
      toast.error('Error al cambiar estado');
    }
  };

  const toggleSeleccion = (tipo, val) => {
    setSeleccionFirmas(prev => {
      const arr = prev[tipo];
      const nuevo = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
      return { ...prev, [tipo]: nuevo };
    });
  };

  const miembrosFiltrados = miembros.filter(m => {
    const texto = busquedaMiembro.toLowerCase();
    const nombre = (m.nombre_completo || '').toLowerCase();
    return nombre.includes(texto);
  });

  if (loading) {
    return (
      <MainLayout>
        <TopBar title={isEdit ? 'Editar Acta' : 'Nueva Acta'} />
        <div className="p-5"><Spinner /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <TopBar title={isEdit ? 'Editar Acta' : 'Nueva Acta'} />
      <div className="p-4">
        <PageHeader title={isEdit ? `Editar Acta ${form.codigo}` : 'Nueva Acta'}>
          {isEdit && (
            <div className="btn-group">
              {ESTADOS.map(e => (
                <button key={e.value} type="button" className={`btn btn-sm ${form.estado === e.value ? 'btn-dark' : 'btn-outline-secondary'}`}
                  onClick={() => handleCambiarEstado(e.value)}>
                  {e.label}
                </button>
              ))}
            </div>
          )}
        </PageHeader>

        <form onSubmit={handleGuardar}>
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Congregación <span className="text-danger">*</span></label>
              <select className="form-select" required value={form.congregacion}
                onChange={e => setForm(f => ({ ...f, congregacion: e.target.value }))}>
                <option value="">Seleccione...</option>
                {congregaciones.map(c => (
                  <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold">Código <span className="text-danger">*</span></label>
              <div className="input-group">
                <input className="form-control" maxLength={7} required value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
                <button type="button" className="btn btn-outline-secondary" onClick={generarCodigo} title="Generar siguiente código">
                  <i className="bi bi-hash"></i>
                </button>
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Título <span className="text-danger">*</span></label>
              <input className="form-control" maxLength={50} required value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold">Fecha <span className="text-danger">*</span></label>
              <input type="date" className="form-control" required value={form.fecha_reunion}
                onChange={e => setForm(f => ({ ...f, fecha_reunion: e.target.value }))} />
            </div>
            <div className="col-md-1">
              <label className="form-label small fw-semibold">Tipo <span className="text-danger">*</span></label>
              <input className="form-control" maxLength={20} required value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} placeholder="Ej: Consejo" />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold">Contenido del acta</label>
            <RichTextEditor value={form.contenido} onChange={v => setForm(f => ({ ...f, contenido: v }))} height={400} />
          </div>

          <div className="d-flex gap-2 mb-4">
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-check2 me-1"></i>Guardar</>}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/secretaria/actas')}>
              Cancelar
            </button>
          </div>
        </form>

        {isEdit && (
          <>
            <hr />
            <h5 className="mb-3"><i className="bi bi-pen me-2"></i>Firmas</h5>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-light fw-semibold">Firmas registradas</div>
                  <ul className="list-group list-group-flush">
                    {firmas.length === 0
                      ? <li className="list-group-item text-muted">Sin firmas registradas</li>
                      : firmas.map(f => (
                        <li key={f.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <span>{f.nombre}</span>
                          <span className="badge bg-success">{f.tipo_firma} - {new Date(f.fecha_firma).toLocaleString()}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-header bg-light fw-semibold">Solicitar firmas por correo</div>
                  <div className="card-body">
                    <label className="form-label small">Miembros sin login</label>
                    <input className="form-control form-control-sm mb-2" placeholder="Buscar miembro..."
                      value={busquedaMiembro} onChange={e => setBusquedaMiembro(e.target.value)} />
                    <div className="border rounded p-2 mb-2" style={{ maxHeight: 150, overflowY: 'auto' }}>
                      {miembrosFiltrados.length === 0
                        ? <small className="text-muted">Sin resultados</small>
                        : miembrosFiltrados.map(m => {
                          const tieneCorreo = !!(m.tercero?.email || m.email || m.correo);
                          return (
                            <div key={m.id} className="form-check">
                              <input className="form-check-input" type="checkbox"
                                checked={seleccionFirmas.miembros.includes(m.id)}
                                onChange={() => toggleSeleccion('miembros', m.id)} id={`m-${m.id}`}
                                disabled={!tieneCorreo} />
                              <label className={`form-check-label ${!tieneCorreo ? 'text-muted' : ''}`} htmlFor={`m-${m.id}`}>
                                {m.nombre_completo}
                                {!tieneCorreo && <small className="ms-1">(sin correo)</small>}
                              </label>
                            </div>
                          );
                        })}
                    </div>
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleEnviarFirmas}>
                      <i className="bi bi-envelope me-1"></i>Enviar enlaces de firma
                    </button>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-light fw-semibold">Firmar yo (con contraseña)</div>
                  <div className="card-body">
                    <div className="input-group">
                      <input type="password" className="form-control" placeholder="Tu contraseña"
                        value={passwordFirma} onChange={e => setPasswordFirma(e.target.value)} />
                      <button type="button" className="btn btn-success" onClick={handleFirmarYo}>
                        <i className="bi bi-pen me-1"></i>Firmar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
