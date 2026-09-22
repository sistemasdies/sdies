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
  '/usuarios':            'usuarios',
  '/roles':               'roles',
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
