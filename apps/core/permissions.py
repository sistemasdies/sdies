from rest_framework.permissions import BasePermission


class HasPermission(BasePermission):
    """
    Verifica que el usuario tenga el permiso indicado en view.required_permission.
    Superusers tienen acceso total.
    """
    message = 'No tiene el permiso necesario para esta acción.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        perm = getattr(view, 'required_permission', None)
        if not perm:
            return True
        return request.user.has_permission(perm)


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
        if user.is_superuser:
            return True
        module = getattr(view, 'module', None)
        if not module:
            return True
        action = _METHOD_ACTION.get(request.method, 'listar')
        code = f'{module}.{action}'
        return user.has_permission(code)
