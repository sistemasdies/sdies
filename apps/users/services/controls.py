"""Catálogo y resolución de controles por rol.

Un control es una característica de la interfaz que puede estar
"Permitido" (P) o "Denegado" (D) para cada rol.
"""

CONTROLES_CATALOGO = [
    {'code': 'editar_movimiento', 'label': 'Botón Editar Movimiento',
     'desc': 'Ventana ver documento (Asientos Contables)'},
    {'code': 'guardar_fecha',     'label': 'Botón Guardar Fecha',
     'desc': 'Chulito ✓ de guardar fecha del documento'},
    {'code': 'guardar_renglon',   'label': 'Botón Guardar Renglón',
     'desc': 'Chulito ✓ de guardar cada renglón'},
    {'code': 'guardar_todo',      'label': 'Botón Guardar Todo',
     'desc': 'Chulito doble ✓ de guardar todos los renglones de un click'},
    {'code': 'ver_notas_pastor',   'label': 'Tab Notas Pastor',
     'desc': 'Pestaña de notas del pastor en Membresía'},
    {'code': 'ver_notas_misionero', 'label': 'Tab Notas Misionero',
     'desc': 'Pestaña de notas del misionero en Membresía'},
]


def controles_usuario(user):
    """Devuelve {code: 'P'|'D'} resueltos. Por defecto todo permitido (P)."""
    from .role_context import es_superusuario_efectivo, rol_efectivo

    resultado = {c['code']: 'P' for c in CONTROLES_CATALOGO}
    if not user or es_superusuario_efectivo(user):
        return resultado

    role = rol_efectivo(user) or getattr(user, 'role', None)
    if not role:
        return resultado

    rc = role.controles or {}
    for c in CONTROLES_CATALOGO:
        if rc.get(c['code']) in ('P', 'D'):
            resultado[c['code']] = rc[c['code']]
    return resultado