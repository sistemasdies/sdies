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
]


def controles_usuario(user):
    """Devuelve {code: 'P'|'D'} resueltos. Por defecto todo permitido (P)."""
    resultado = {c['code']: 'P' for c in CONTROLES_CATALOGO}
    if user.is_superuser or not user.role:
        return resultado
    rc = user.role.controles or {}
    for c in CONTROLES_CATALOGO:
        if rc.get(c['code']) in ('P', 'D'):
            resultado[c['code']] = rc[c['code']]
    return resultado