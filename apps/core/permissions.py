from rest_framework.permissions import BasePermission

from apps.users.services.role_context import (
    es_superusuario_efectivo,
    tiene_permiso_efectivo,
)


class HasPermission(BasePermission):
    """
    Verifica que el usuario tenga el permiso indicado en view.required_permission.
    Los superusuarios tienen acceso total, salvo cuando están asumiendo un rol.
    """
    message = 'No tiene el permiso necesario para esta acción.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if es_superusuario_efectivo(request.user):
            return True
        perm = getattr(view, 'required_permission', None)
        if not perm:
            return True
        return tiene_permiso_efectivo(request.user, perm)


_METHOD_ACTION = {
    'GET':    'listar',
    'HEAD':   'listar',
    'OPTIONS':'listar',
    'POST':   'agregar',
    'PUT':    'editar',
    'PATCH':  'editar',
    'DELETE': 'borrar',
}


class ModulePermission(BasePermission):
    """
    Verifica permisos por módulo y acción.
    La vista debe definir `module = 'accounting'` (etc).
    GET/HEAD/OPTIONS → module.listar
    POST             → module.agregar
    PUT/PATCH        → module.editar
    DELETE           → module.borrar
    """
    message = 'No tiene permisos suficientes para esta acción.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if es_superusuario_efectivo(user):
            return True
        # Algunas vistas necesitan un permiso distinto al que sugiere el método
        # HTTP (por ejemplo, una acción POST que en realidad edita).
        perm = getattr(view, 'required_permission', None)
        if perm:
            return tiene_permiso_efectivo(user, perm)
        module = getattr(view, 'module', None)
        if not module:
            return True
        action = _METHOD_ACTION.get(request.method, 'listar')
        code = f'{module}.{action}'
        return tiene_permiso_efectivo(user, code)
