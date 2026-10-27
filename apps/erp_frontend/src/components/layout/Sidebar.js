import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const MENU = [
  { to: '/dashboard',           icon: 'bi-speedometer2',        label: 'Dashboard',               mod: null },
  { to: '/asientos',            icon: 'bi-journal-text',        label: 'Asientos',                mod: 'asientos' },
  { to: '/asientos/plantilla',  icon: 'bi-layout-text-window',  label: 'Asiento con plantilla',   mod: 'asientos_plantilla' },
];

const GRUPOS = [
  {
    key: 'tablas',
    icon: 'bi-table',
    label: 'Tablas',
    mod: null,
    requerir_hijos: true,
    hijos: [
      { to: '/cuentas',        icon: 'bi-diagram-3',         label: 'Plan de Cuentas',         mod: 'plan_cuentas' },
      { to: '/plantillas',     icon: 'bi-journals',           label: 'Plantillas contables',    mod: 'plantillas' },
      { to: '/terceros',       icon: 'bi-people',             label: 'Terceros',                mod: 'terceros' },
      { to: '/centros-costo',  icon: 'bi-bullseye',           label: 'Centros de Costo',        mod: 'centros_costo' },
      { to: '/comprobantes',   icon: 'bi-receipt',            label: 'Comprobantes',            mod: 'comprobantes' },
      { to: '/roles',          icon: 'bi-shield',             label: 'Roles',                   mod: 'roles' },
      { to: '/usuarios',       icon: 'bi-person-gear',        label: 'Usuarios',                mod: 'usuarios' },
    ],
  },
  {
    key: 'procesos',
    icon: 'bi-gear',
    label: 'Procesos',
    mod: null,
    requerir_hijos: true,
    hijos: [
      { to: '/procesos/bloquear-fecha',     icon: 'bi-calendar-x',     label: 'Bloquear Fecha',     mod: 'usuarios' },
      { to: '/procesos/cierre-periodo',    icon: 'bi-calendar-check', label: 'Cierre de Periodo',   mod: 'periodos' },
      { to: '/procesos/generar-balance',   icon: 'bi-calculator',     label: 'Generar Balance',     mod: 'reportes' },
      { to: '/procesos/generar-presupuesto', icon: 'bi-journal-check', label: 'Generar Presupuesto', mod: 'reportes' },
      { to: '/procesos/correccion-datos',  icon: 'bi-tools',          label: 'Corrección de Datos', mod: 'correccion_datos' },
      { to: '/procesos/copia-seguridad',   icon: 'bi-database-down',  label: 'Copia de Seguridad',  soloStaff: true },
      { to: '/importar',                   icon: 'bi-cloud-upload',   label: 'Importar datos',     mod: 'importar' },
      { to: '/procesos/exportar-datos',    icon: 'bi-cloud-download', label: 'Exportar datos',     mod: 'exportar' },
    ],
  },
  {
    key: 'secretaria',
    icon: 'bi-building',
    label: 'Secretaría',
    mod: null,
    requerir_hijos: true,
    hijos: [
      { to: '/secretaria/membresia', icon: 'bi-person-badge', label: 'Membresía', mod: 'membresias' },
      { to: '/secretaria/congregaciones', icon: 'bi-house-door', label: 'Congregaciones', mod: 'congregaciones' },
      { to: '/secretaria/estados', icon: 'bi-tags', label: 'Estados', mod: 'estados' },
    ],
  },
  {
    key: 'informes',
    icon: 'bi-file-earmark-bar-graph',
    label: 'Informes',
    mod: null,
    requerir_hijos: true,
    hijos: [
      { to: '/informes/auxiliares',          icon: 'bi-list-ul',       label: 'Auxiliares',          mod: 'reportes' },
      { to: '/informes/comparativo-meses',    icon: 'bi-calendar3',     label: 'Saldos Meses/Años',   mod: 'reportes' },
      { to: '/informes/estado-presupuestal', icon: 'bi-graph-up-arrow', label: 'Estado Presupuestal', mod: 'reportes' },
      { to: '/reportes',                    icon: 'bi-cash-coin',        label: 'Balances',          mod: 'reportes' },
    ],
  },
  {
    key: 'configuracion',
    icon: 'bi-sliders',
    label: 'Configuración',
    mod: null,
    requerir_hijos: true,
    hijos: [
      { to: '/configuracion/datos-generales', icon: 'bi-building-gear', label: 'Datos Generales', mod: 'datos_generales' },
    ],
  },
];

export default function Sidebar() {
  const { user, hasModulePermission, logout, marca } = useAuth();
  const location = useLocation();
  const [abiertos, setAbiertos] = useState(() => {
    const inc = {};
    GRUPOS.forEach(g => { if (g.hijos?.some(h => location.pathname.startsWith(h.to))) inc[g.key] = true; });
    return inc;
  });

  const toggle = (key) => setAbiertos(p => ({ ...p, [key]: !p[key] }));

  const puedeVer = (item) => {
    if (item.soloStaff) return !!(user?.is_superuser || user?.is_staff);
    if (!item.mod) return true;
    if (user?.is_superuser) return true;
    // Visible si tiene cualquier permiso del módulo (no solo 'acceder')
    return ['acceder', 'listar', 'agregar', 'editar', 'borrar', 'anular']
      .some(a => hasModulePermission(item.mod, a));
  };

  return (
    <div className="d-flex flex-column bg-dark text-white vh-100 position-fixed"
         style={{ width: 240, zIndex: 100 }}>
      {/* Logo */}
      <div className="px-3 py-3 border-bottom border-secondary">
        <div className="d-flex align-items-center gap-2">
          {marca?.logoDeLaApp
            ? <img src={marca.logoDeLaApp} alt="Logo" style={{ height: 36, maxWidth: 40, objectFit: 'contain' }} />
            : <i className="bi bi-calculator fs-4 text-success"></i>}
          <div className="overflow-hidden">
            <div className="fw-bold small text-truncate">{marca?.NombreOrganizacion || 'SDIES'}</div>
            <div className="text-white-50 text-truncate" style={{ fontSize: 11 }}>
              <i className="bi bi-person-circle me-1"></i>{user?.NameUser || user?.login}
            </div>
            <div className="text-muted text-truncate" style={{ fontSize: 11 }}>
              {marca?.NIT ? `NIT ${marca.NIT}` : 'Sistema Contable'}
            </div>
          </div>
        </div>
      </div>

      {/* Menú */}
      <nav className="flex-grow-1 overflow-auto py-2">
        {MENU.map(({ to, icon, label, mod }) => {
          const visible = puedeVer({ mod });
          if (!visible) return null;
          return (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `d-flex align-items-center gap-2 px-3 py-2 text-decoration-none small
                 ${isActive ? 'bg-success text-white' : 'text-white-50'}`}>
              <i className={`bi ${icon}`}></i>
              <span>{label}</span>
            </NavLink>
          );
        })}

        {GRUPOS.map(g => {
          const hijosVisibles = g.hijos.filter(puedeVer);
          const visible = g.mod
            ? puedeVer(g)
            : (g.requerir_hijos ? hijosVisibles.length > 0 : true);
          if (!visible) return null;
          const abierto = abiertos[g.key];
          const activo = hijosVisibles.some(h => location.pathname.startsWith(h.to));
          return (
            <div key={g.key}>
              <button
                className={`d-flex align-items-center gap-2 px-3 py-2 w-100 border-0 bg-transparent text-start small ${
                  abierto || activo ? 'text-white' : 'text-white-50'}`}
                onClick={() => toggle(g.key)}>
                <i className={`bi ${g.icon}`}></i>
                <span className="flex-grow-1">{g.label}</span>
                <i className={`bi bi-chevron-${abierto ? 'down' : 'right'} small`}></i>
              </button>
              {abierto && (
                <div className="ms-3 border-start border-secondary">
                  {hijosVisibles.map(h => (
                    <NavLink key={h.to} to={h.to}
                      className={({ isActive }) =>
                        `d-flex align-items-center gap-2 px-3 py-2 text-decoration-none small
                         ${isActive ? 'bg-success text-white' : 'text-white-50'}`}>
                      <i className={`bi ${h.icon}`}></i>
                      <span>{h.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="px-3 py-3 border-top border-secondary">
        <div className="small text-white-50 mb-1 text-truncate">
          <i className="bi bi-person-circle me-1"></i>
          {user?.NameUser || user?.login}
        </div>
        <button className="btn btn-outline-danger btn-sm w-100" onClick={logout}>
          <i className="bi bi-box-arrow-right me-1"></i>Cerrar sesión
        </button>
      </div>
    </div>
  );
}