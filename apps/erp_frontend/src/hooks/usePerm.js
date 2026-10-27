import { useAuth } from '../context/AuthContext';

const MODULE_MAP = {
  '/cuentas':             'plan_cuentas',
  '/asientos':            'asientos',
  '/asientos/plantilla':  'asientos_plantilla',
  '/plantillas':          'plantillas',
  '/terceros':            'terceros',
  '/centros-costo':       'centros_costo',
  '/comprobantes':        'comprobantes',
  '/periodos':            'periodos',
  '/reportes':            'reportes',
  '/importar':            'importar',
  '/procesos/exportar-datos': 'exportar',
  '/procesos/correccion-datos': 'correccion_datos',
  '/configuracion/datos-generales': 'datos_generales',
  '/usuarios':            'usuarios',
  '/roles':               'roles',
  '/secretaria/membresia':'membresias',
  '/secretaria/congregaciones': 'congregaciones',
  '/secretaria/estados':        'estados',
};

export function usePerm(pathname) {
  const { hasModulePermission } = useAuth();

  const path = pathname || '';
  const mod = MODULE_MAP[path] || MODULE_MAP[path.replace(/\/[^/]+$/, '')];

  if (!mod) return { canEnter: true, canList: true, canAdd: true, canEdit: true, canDel: true, canAnular: true };

  return {
    canEnter:  hasModulePermission(mod, 'acceder'),
    canList:   hasModulePermission(mod, 'listar'),
    canAdd:    hasModulePermission(mod, 'agregar'),
    canEdit:   hasModulePermission(mod, 'editar'),
    canDel:    hasModulePermission(mod, 'borrar'),
    canAnular: hasModulePermission(mod, 'anular'),
    module:    mod,
  };
}
