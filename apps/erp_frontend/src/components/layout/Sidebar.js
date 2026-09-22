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
    hijos: [
      { to: '/procesos/bloquear-fecha',     icon: 'bi-calendar-x',     label: 'Bloquear Fecha' },
      { to: '/procesos/cierre-periodo',    icon: 'bi-calendar-check', label: 'Cierre de Periodo' },
      { to: '/procesos/generar-balance',   icon: 'bi-calculator',     label: 'Generar Balance' },
      { to: '/procesos/generar-presupuesto', icon: 'bi-journal-check', label: 'Generar Presupuesto' },
      { to: '/procesos/correccion-datos',  icon: 'bi-tools',          label: 'Corrección de Datos' },
      { to: '/procesos/copia-seguridad',   icon: 'bi-database-down',  label: 'Copia de Seguridad' },
      { to: '/importar',                   icon: 'bi-cloud-upload',   label: 'Importar datos',     mod: 'importar' },
    ],
  },
  {
    key: 'informes',
    icon: 'bi-file-earmark-bar-graph',
    label: 'Informes',
    mod: null,
    hijos: [
      { to: '/informes/auxiliares',          icon: 'bi-list-ul',       label: 'Auxiliares' },
      { to: '/informes/saldos',              icon: 'bi-wallet2',       label: 'Saldos' },
      { to: '/informes/estado-presupuestal', icon: 'bi-graph-up-arrow', label: 'Estado Presupuestal' },
      { to: '/reportes',                    icon: 'bi-cash-coin',        label: 'Balances',          mod: 'reportes' },
    ],
  },
];

export default function Sidebar() {
  const { user, hasModulePermission, logout } = useAuth();
  const location = useLocation();
  const [abiertos, setAbiertos] = useState(() => {
    const inc = {};
    GRUPOS.forEach(g => { if (g.hijos?.some(h => location.pathname.startsWith(h.to))) inc[g.key] = true; });
    return inc;
  });

  const toggle = (key) => setAbiertos(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="d-flex flex-column bg-dark text-white vh-100 position-fixed"
         style={{ width: 240, zIndex: 100 }}>
      {/* Logo */}
      <div className="px-3 py-3 border-bottom border-secondary">
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-calculator fs-4 text-success"></i>
          <div>
            <div className="fw-bold small">SDIES</div>
            <div className="text-muted" style={{ fontSize: 11 }}>Sistema Contable</div>
          </div>
        </div>
      </div>

      {/* Menú */}
      <nav className="flex-grow-1 overflow-auto py-2">
        {MENU.map(({ to, icon, label, mod }) => {
          const visible = !mod || user?.is_superuser || hasModulePermission(mod, 'acceder');
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
          const hijosVisibles = g.hijos.filter(h =>
            !h.mod || user?.is_superuser || hasModulePermission(h.mod, 'acceder'));
          const visible = g.mod
            ? (user?.is_superuser || hasModulePermission(g.mod, 'acceder'))
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