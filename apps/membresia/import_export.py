"""Columnas y conversiones compartidas para importar/exportar membresías.

El orden de ``CAMPOS_MEMBRESIA`` es el mismo en la exportación CSV y en la
plantilla de importación, de modo que un archivo exportado se puede volver a
importar sin cambios.
"""
import datetime
import unicodedata

from apps.membresia.models import (
    EstadoCivil, EstadoMembresia, Membresia, TipoMatrimonio,
)


def _estados_membresia_choices():
    """Lista (codigo, descripcion) de la tabla EstadosMembresia.

    Se intenta leer de BD; si no está disponible (p. ej. durante migraciones)
    se usa un listado fijo equivalente a los 8 estados semilla.
    """
    try:
        return list(EstadoMembresia.objects.values_list('estado', 'descripcion'))
    except Exception:
        return [
            ('1', 'Activo'),
            ('2', 'Ausente'),
            ('3', 'Vacaciones'),
            ('4', 'Trasladado'),
            ('5', 'Enfermo'),
            ('6', 'Apartado'),
            ('7', 'Desconocido'),
            ('8', 'Renuncia'),
        ]


# Todos los campos de datos de la tabla Membresia. La cédula es la llave hacia
# accounting.Tercero y "congregacion" se maneja por código.
CAMPOS_MEMBRESIA = [
    # Datos generales
    'cedula',
    # Datos familiares
    'estado_civil', 'fecha_matrimonio', 'tipo_matrimonio', 'lugar_matrimonio',
    'nombre_oficiado_por', 'nombre_papa', 'nombre_mama', 'nombre_conyuge',
    'personas_a_cargo', 'comentario_familiar', 'folio_reg_civil',
    'oficina_reg_civil', 'lugar_fallecimiento', 'fecha_fallecido',
    # Datos académicos y laborales
    'escolaridad', 'profesion', 'ocupacion', 'lugar_de_trabajo',
    'telefono_trabajo', 'comentarios_academico_laboral',
    # Datos eclesiásticos
    'estado', 'comentarios_eclesiales', 'congregacion',
    'sw_bautizado', 'serial_bautismo', 'fecha_bautismo', 'lugar_bautismo',
    'pastor_que_bautizo',
    'sw_promesado', 'serial_membresia', 'fecha_promesado', 'lugar_promesado',
    'congregacion_anterior', 'salio_para', 'fecha_llegada', 'fecha_salida',
    # Foto
    'foto', 'foto_public_id',
]

CAMPOS_FECHA = frozenset({
    'fecha_matrimonio', 'fecha_fallecido', 'fecha_bautismo',
    'fecha_promesado', 'fecha_llegada', 'fecha_salida',
})

CAMPOS_BOOLEANOS = frozenset({'sw_bautizado', 'sw_promesado'})

CAMPOS_ENTEROS = frozenset({
    'personas_a_cargo', 'serial_bautismo', 'serial_membresia',
})

_CHOICES = {
    'estado':          _estados_membresia_choices(),
    'estado_civil':    EstadoCivil.choices,
    'tipo_matrimonio': TipoMatrimonio.choices,
}

_MAX_LENGTHS = {
    f.name: f.max_length
    for f in Membresia._meta.fields
    if getattr(f, 'max_length', None)
}


def _sin_acentos(texto):
    return ''.join(
        c for c in unicodedata.normalize('NFKD', str(texto))
        if not unicodedata.combining(c)
    ).lower().strip()


def _mapa_choices(choices):
    """Acepta tanto el código ('1') como la etiqueta ('Activo') sin distinguir
    mayúsculas ni tildes."""
    mapa = {}
    for codigo, etiqueta in choices:
        mapa[str(codigo).strip().lower()] = codigo
        mapa[_sin_acentos(etiqueta)] = codigo
    return mapa


_MAPAS_CHOICES = {campo: _mapa_choices(choices)
                  for campo, choices in _CHOICES.items()}


def _parse_fecha(valor):
    if valor is None:
        return None, None
    texto = str(valor).strip()
    if not texto:
        return None, None
    for formato in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return datetime.datetime.strptime(texto, formato).date(), None
        except ValueError:
            continue
    return None, f'{texto}: fecha inválida (use AAAA-MM-DD)'


def _parse_booleano(valor):
    texto = str(valor if valor is not None else '').strip().lower()
    if texto in ('', '0', 'false', 'no', 'n', 'f'):
        return False, None
    if texto in ('1', 'true', 'si', 'sí', 's', 'yes', 'x'):
        return True, None
    return None, f'{valor}: valor booleano inválido (use true/false)'


def _parse_entero(campo, valor):
    texto = str(valor if valor is not None else '').strip()
    if not texto:
        return (0 if campo == 'personas_a_cargo' else None), None
    try:
        numero = int(texto)
    except (TypeError, ValueError):
        return None, f'{texto}: debe ser un número entero'
    if campo == 'personas_a_cargo' and numero < 0:
        return None, f'{texto}: las personas a cargo no pueden ser negativas'
    return numero, None


def _parse_choice(campo, valor):
    texto = str(valor if valor is not None else '').strip()
    if not texto:
        return '', None
    codigo = _MAPAS_CHOICES[campo].get(_sin_acentos(texto))
    if codigo is None:
        opciones = ', '.join(etiqueta for _, etiqueta in _CHOICES[campo])
        return None, f'{texto}: valor no válido (use {opciones})'
    return codigo, None


def convertir_campo(campo, valor):
    """Convierte un valor de CSV al tipo del modelo.

    Devuelve ``(valor, error)``. Si hay error, ``valor`` es ``None``.
    """
    if campo in CAMPOS_FECHA:
        return _parse_fecha(valor)
    if campo in CAMPOS_BOOLEANOS:
        return _parse_booleano(valor)
    if campo in CAMPOS_ENTEROS:
        return _parse_entero(campo, valor)
    if campo in _MAPAS_CHOICES:
        codigo, error = _parse_choice(campo, valor)
        if error:
            return None, error
        if campo == 'estado' and codigo not in ('', None):
            from apps.membresia.models import EstadoMembresia
            try:
                return EstadoMembresia.objects.get(estado=codigo), None
            except EstadoMembresia.DoesNotExist:
                opciones = ', '.join(etiqueta for _, etiqueta in _CHOICES['estado'])
                return None, f'{valor}: valor no válido (use {opciones})'
        return codigo, None

    texto = '' if valor is None else str(valor).strip()
    limite = _MAX_LENGTHS.get(campo)
    if limite and len(texto) > limite:
        return None, f'{campo}: supera el máximo de {limite} caracteres'
    return texto, None


def valor_exportacion(membresia, campo):
    """Valor del campo listo para escribirse en el CSV."""
    if campo == 'cedula':
        return membresia.tercero_id or ''
    if campo == 'congregacion':
        return membresia.congregacion_id or ''
    if campo == 'estado':
        return membresia.estado_id or ''

    valor = getattr(membresia, campo)
    if valor is None:
        return ''
    if isinstance(valor, bool):
        return 'true' if valor else 'false'
    if isinstance(valor, (datetime.date, datetime.datetime)):
        return valor.isoformat()
    if isinstance(valor, str):
        return valor.replace('\r', ' ').replace('\n', ' ')
    return valor
