"""Alcance de datos permitidos por rol.

Semántica: si el rol NO tiene nada seleccionado en una categoría, se considera
que tiene acceso a TODOS los ítems de esa categoría (None). Si tiene selección,
solo los códigos seleccionados (y, para cuentas, sus descendientes) son válidos.
"""


def user_scope(user):
    """Devuelve los códigos permitidos según el rol de `user`.

    Retorna un dict con las claves 'centros_costo', 'cuentas' y 'comprobantes'.
    Valor None = sin restricción (todos).
    """
    if not user or user.is_superuser or not getattr(user, 'role', None):
        return {'centros_costo': None, 'cuentas': None, 'comprobantes': None}
    role = user.role
    return {
        'centros_costo': _codigos_o_none(role.centros_costo),
        'comprobantes':  _codigos_o_none(role.comprobantes),
        'cuentas':       _cuentas_con_hijas(role),
    }


def fecha_cierre_usuario(user):
    """Fecha de cierre contable del usuario (None si no tiene restricción).

    Los superusuarios no tienen restricción de fecha de cierre.
    """
    if not user or user.is_superuser:
        return None
    return getattr(user, 'fecha_cierre', None)


def validar_fecha_cierre(user, fecha, accion='adicionar movimientos'):
    """Valida que `fecha` respete la fecha de cierre del usuario.

    Regla: no se permite trabajar (crear/modificar/eliminar) movimientos
    contables 'MoviCont' con fecha igual o anterior a la fecha de cierre.
    Devuelve un mensaje de error o None si está permitido.
    """
    cierre = fecha_cierre_usuario(user)
    if cierre is None or fecha is None:
        return None
    if fecha <= cierre:
        return (f"No puede {accion} con fecha igual o anterior a {cierre.isoformat()} "
                f"(fecha de cierre de su usuario).")
    return None


def _codigos_o_none(manager):
    codigos = set(manager.values_list('codigo', flat=True))
    return codigos if codigos else None


def _cuentas_con_hijas(role):
    """Cuentas seleccionadas más todas sus hijas (jerarquía por prefijo)."""
    from apps.accounting.models import Cuenta
    seleccion = set(role.cuentas.values_list('codigo', flat=True))
    if not seleccion:
        return None
    permitidas = set()
    for codigo in seleccion:
        permitidas.add(codigo)
        permitidas.update(
            Cuenta.objects.filter(deleted=False, codigo__startswith=codigo)
                          .values_list('codigo', flat=True))
    return permitidas