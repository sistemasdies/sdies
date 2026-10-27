"""Rol efectivo de una petición.

Un administrador puede "usar" temporalmente otro rol para comprobar cómo ve y
qué puede hacer. El rol real del usuario **no se modifica**: la autenticación
guarda el rol asumido en el atributo ``rol_efectivo`` de la instancia de
usuario, que vive solo durante la petición.

Todas las comprobaciones de permisos, alcance de datos y controles deben pasar
por estas funciones para que el rol asumido se aplique de verdad.
"""

ROL_ADMIN = 'Administrador'


def es_administrador(user):
    """¿El usuario real puede usar/retomar roles?

    Se considera administrador al superusuario y a cualquier usuario cuyo rol
    real sea ``Administrador``. El rol asumido no cuenta aquí: así el
    administrador conserva la capacidad de retomar su rol.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'is_superuser', False):
        return True
    role = getattr(user, 'role', None)
    return bool(role and role.NameRole == ROL_ADMIN)


def rol_efectivo(user):
    """Rol asumido en esta petición, o None si se está usando el rol real."""
    return getattr(user, 'rol_efectivo', None)


def es_superusuario_efectivo(user):
    """Superusuario real que no está asumiendo otro rol."""
    return bool(user and getattr(user, 'is_superuser', False)
                and rol_efectivo(user) is None)


def es_staff_efectivo(user):
    """Staff real que no está asumiendo otro rol."""
    return bool(user and getattr(user, 'is_staff', False)
                and rol_efectivo(user) is None)


def tiene_permiso_efectivo(user, code):
    """Comprueba un permiso con el rol efectivo."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    role = rol_efectivo(user)
    if role is not None:
        return role.permissions.filter(code=code).exists()
    return user.has_permission(code)
