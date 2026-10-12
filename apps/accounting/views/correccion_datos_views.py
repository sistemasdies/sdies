"""Corrección masiva de datos (Procesos → Corrección de Datos).

Permite seleccionar un subconjunto de registros mediante filtros y
sobrescribir un único campo en todos ellos. El servidor re-evalúa los filtros,
valida el nuevo valor y registra el cambio en la bitácora (AuditLog).
"""
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission
from apps.accounting.models import (
    CentroCosto, Comprobante, Cuenta, DetallePlantilla, MoviCont,
    PlantillaContable, Tercero,
)
from apps.users.services.scopes import user_scope, fecha_cierre_usuario, validar_fecha_cierre

MODULE = 'correccion_datos'
MAX_MUESTRA = 30


# ── Helpers ──────────────────────────────────────────────────────────────────

def _to_list(valor):
    if valor is None:
        return []
    if isinstance(valor, (list, tuple)):
        return [str(v).strip() for v in valor if str(v).strip()]
    return [x.strip() for x in str(valor).split(',') if x.strip()]


def _to_decimal(valor):
    if valor is None or str(valor).strip() == '':
        return None
    try:
        return Decimal(str(valor).replace(',', '.'))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _to_int(valor):
    if valor is None or str(valor).strip() == '':
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def _to_date(valor):
    texto = str(valor or '').strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y'):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


# ── Definición de tablas ─────────────────────────────────────────────────────

CAMPOS_EDITABLES = {
    'movicont': [
        {'campo': 'cuenta',       'label': 'Cuenta',          'tipo': 'select_cuenta',      'update_key': 'cuenta_id'},
        {'campo': 'centro_costo', 'label': 'Centro de costo', 'tipo': 'select_centro',      'update_key': 'centro_costo_id'},
        {'campo': 'cedula',       'label': 'Cédula (tercero)','tipo': 'select_cedula',      'update_key': 'cedula_id'},
        {'campo': 'observacion',  'label': 'Observación',     'tipo': 'texto', 'max': 200,   'update_key': 'observacion'},
        {'campo': 'doc_ref',      'label': 'Doc. referencia', 'tipo': 'texto', 'max': 14,    'update_key': 'doc_ref'},
        {'campo': 'doc_soporte',  'label': 'Doc. soporte',    'tipo': 'texto', 'max': 15,    'update_key': 'doc_soporte'},
        {'campo': 'vr_debitos',   'label': 'Débitos',         'tipo': 'numero',            'update_key': 'vr_debitos'},
        {'campo': 'vr_creditos',  'label': 'Créditos',        'tipo': 'numero',            'update_key': 'vr_creditos'},
        {'campo': 'fecha',        'label': 'Fecha',           'tipo': 'fecha',             'update_key': 'fecha'},
    ],
    'plantillas': [
        {'campo': 'nombre',      'label': 'Nombre',      'tipo': 'texto', 'max': 60,  'update_key': 'nombre'},
        {'campo': 'descripcion', 'label': 'Descripción', 'tipo': 'texto', 'max': 200, 'update_key': 'descripcion'},
        {'campo': 'comprobante', 'label': 'Comprobante', 'tipo': 'select_comprobante', 'update_key': 'comprobante_id'},
    ],
    'det_plantillas': [
        {'campo': 'cuenta',       'label': 'Cuenta',           'tipo': 'select_cuenta',   'update_key': 'cuenta'},
        {'campo': 'doc_ref',      'label': 'Doc. referencia',  'tipo': 'texto', 'max': 8,   'update_key': 'doc_ref'},
        {'campo': 'observacion',  'label': 'Observación',      'tipo': 'texto', 'max': 200, 'update_key': 'observacion'},
        {'campo': 'tipo_mov',     'label': 'Tipo movimiento',  'tipo': 'select_tipo_mov', 'update_key': 'tipo_mov'},
        {'campo': 'valor',        'label': 'Valor',            'tipo': 'texto', 'max': 32,  'update_key': 'valor'},
        {'campo': 'base',         'label': 'Base',             'tipo': 'texto', 'max': 32,  'update_key': 'base'},
        {'campo': 'cedula',       'label': 'Cédula',           'tipo': 'select_cedula',   'update_key': 'cedula'},
        {'campo': 'centro_costo', 'label': 'Centro de costo',  'tipo': 'select_centro',   'update_key': 'centro_costo'},
        {'campo': 'comentarios',  'label': 'Comentarios',      'tipo': 'texto', 'max': 200, 'update_key': 'comentarios'},
        {'campo': 'doc_soporte',  'label': 'Doc. soporte',     'tipo': 'texto', 'max': 15,  'update_key': 'doc_soporte'},
    ],
}

COLUMNAS_MUESTRA = {
    'movicont': [
        {'key': 'cod_comprob', 'label': 'Comprob.'}, {'key': 'num_comprob', 'label': 'Número'},
        {'key': 'item_comprob', 'label': 'Ítem'}, {'key': 'fecha', 'label': 'Fecha'},
        {'key': 'cuenta', 'label': 'Cuenta'}, {'key': 'cedula', 'label': 'Cédula'},
        {'key': 'centro_costo', 'label': 'C. Costo'}, {'key': 'doc_ref', 'label': 'Doc. Ref.'},
        {'key': 'observacion', 'label': 'Observación'}, {'key': 'vr_debitos', 'label': 'Débitos'},
        {'key': 'vr_creditos', 'label': 'Créditos'},
    ],
    'plantillas': [
        {'key': 'cod_plantilla', 'label': 'Código'}, {'key': 'nombre', 'label': 'Nombre'},
        {'key': 'descripcion', 'label': 'Descripción'}, {'key': 'comprobante', 'label': 'Comprobante'},
    ],
    'det_plantillas': [
        {'key': 'plantilla', 'label': 'Plantilla'}, {'key': 'item', 'label': 'Ítem'},
        {'key': 'cuenta', 'label': 'Cuenta'}, {'key': 'doc_ref', 'label': 'Doc. Ref.'},
        {'key': 'observacion', 'label': 'Observación'}, {'key': 'tipo_mov', 'label': 'Tipo'},
        {'key': 'valor', 'label': 'Valor'}, {'key': 'base', 'label': 'Base'},
        {'key': 'cedula', 'label': 'Cédula'}, {'key': 'centro_costo', 'label': 'C. Costo'},
        {'key': 'comentarios', 'label': 'Comentarios'},
    ],
}


def _qs_movicont(filtros, user):
    qs = MoviCont.objects.filter(deleted=False)
    scope = user_scope(user)
    if scope['comprobantes'] is not None:
        qs = qs.filter(cod_comprob__codigo__in=scope['comprobantes'])
    if scope['cuentas'] is not None:
        qs = qs.filter(cuenta__codigo__in=scope['cuentas'])
    if scope['centros_costo'] is not None:
        qs = qs.filter(centro_costo__codigo__in=scope['centros_costo'])

    f = filtros or {}
    if f.get('fecha_desde'):
        qs = qs.filter(fecha__gte=f['fecha_desde'])
    if f.get('fecha_hasta'):
        qs = qs.filter(fecha__lte=f['fecha_hasta'])
    comps = _to_list(f.get('comprobante'))
    if comps:
        qs = qs.filter(cod_comprob__codigo__in=comps)
    cuentas = _to_list(f.get('cuenta'))
    if cuentas:
        qs = qs.filter(cuenta__codigo__in=cuentas)
    centros = _to_list(f.get('centro_costo'))
    if centros:
        qs = qs.filter(centro_costo__codigo__in=centros)
    cedulas = _to_list(f.get('cedula'))
    if cedulas:
        qs = qs.filter(cedula__in=cedulas)
    if f.get('doc_ref'):
        qs = qs.filter(doc_ref__icontains=f['doc_ref'])
    if f.get('doc_soporte'):
        qs = qs.filter(doc_soporte__icontains=f['doc_soporte'])
    if f.get('observacion'):
        qs = qs.filter(observacion__icontains=f['observacion'])

    num_min = _to_int(f.get('num_min'))
    num_max = _to_int(f.get('num_max'))
    if num_min is not None:
        qs = qs.filter(num_comprob__gte=num_min)
    if num_max is not None:
        qs = qs.filter(num_comprob__lte=num_max)

    for prefijo, campo in (('deb', 'vr_debitos'), ('cre', 'vr_creditos')):
        vmin = _to_decimal(f.get(f'{prefijo}_min'))
        vmax = _to_decimal(f.get(f'{prefijo}_max'))
        if vmin is not None:
            qs = qs.filter(**{f'{campo}__gte': vmin})
        if vmax is not None:
            qs = qs.filter(**{f'{campo}__lte': vmax})

    return qs.order_by('fecha', 'num_comprob', 'item_comprob')


def _qs_plantillas(filtros, user):
    qs = PlantillaContable.objects.filter(deleted=False)
    f = filtros or {}
    if f.get('cod_plantilla'):
        qs = qs.filter(cod_plantilla__icontains=f['cod_plantilla'])
    if f.get('nombre'):
        qs = qs.filter(nombre__icontains=f['nombre'])
    if f.get('descripcion'):
        qs = qs.filter(descripcion__icontains=f['descripcion'])
    comps = _to_list(f.get('comprobante'))
    if comps:
        qs = qs.filter(comprobante__codigo__in=comps)
    return qs.order_by('cod_plantilla')


def _qs_det_plantillas(filtros, user):
    qs = DetallePlantilla.objects.filter(deleted=False).select_related('plantilla')
    f = filtros or {}
    plantillas = _to_list(f.get('plantilla'))
    if plantillas:
        qs = qs.filter(plantilla__cod_plantilla__in=plantillas)
    item = _to_int(f.get('item'))
    if item is not None:
        qs = qs.filter(item=item)
    for key, campo in (('cuenta', 'cuenta'), ('cedula', 'cedula'),
                       ('centro_costo', 'centro_costo')):
        vals = _to_list(f.get(key))
        if vals:
            qs = qs.filter(**{f'{campo}__in': vals})
    if f.get('tipo_mov'):
        qs = qs.filter(tipo_mov=str(f['tipo_mov']).strip().upper())
    for key, campo in (('doc_ref', 'doc_ref'), ('observacion', 'observacion'),
                       ('comentarios', 'comentarios'), ('doc_soporte', 'doc_soporte'),
                       ('valor', 'valor'), ('base', 'base')):
        if f.get(key):
            qs = qs.filter(**{f'{campo}__icontains': f[key]})
    return qs.order_by('plantilla__cod_plantilla', 'item')


TABLAS = {
    'movicont':       {'qs': _qs_movicont,       'modelo': 'MoviCont'},
    'plantillas':     {'qs': _qs_plantillas,     'modelo': 'PlantillaContable'},
    'det_plantillas': {'qs': _qs_det_plantillas, 'modelo': 'DetallePlantilla'},
}


def _ser_movicont(m):
    return {
        'cod_comprob': m.cod_comprob_id, 'num_comprob': m.num_comprob,
        'item_comprob': m.item_comprob,
        'fecha': m.fecha.isoformat() if m.fecha else '',
        'cuenta': m.cuenta_id, 'cedula': m.cedula_id or '',
        'centro_costo': m.centro_costo_id or '', 'doc_ref': m.doc_ref,
        'observacion': m.observacion, 'doc_soporte': m.doc_soporte,
        'vr_debitos': str(m.vr_debitos), 'vr_creditos': str(m.vr_creditos),
    }


def _ser_plantilla(p):
    return {
        'cod_plantilla': p.cod_plantilla, 'nombre': p.nombre,
        'descripcion': p.descripcion, 'comprobante': p.comprobante_id or '',
    }


def _ser_detalle(d):
    return {
        'plantilla': d.plantilla.cod_plantilla, 'item': d.item,
        'cuenta': d.cuenta, 'doc_ref': d.doc_ref, 'observacion': d.observacion,
        'tipo_mov': d.tipo_mov, 'valor': d.valor, 'base': d.base,
        'cedula': d.cedula, 'centro_costo': d.centro_costo,
        'comentarios': d.comentarios, 'doc_soporte': d.doc_soporte,
    }


SERIALIZADORES = {
    'movicont': _ser_movicont,
    'plantillas': _ser_plantilla,
    'det_plantillas': _ser_detalle,
}


def _preparar_valor(tabla, fdef, valor, scope):
    """Valida y normaliza el nuevo valor. Devuelve (valor_db, error, kwargs_extra)."""
    tipo = fdef['tipo']

    if tipo == 'texto':
        texto = '' if valor is None else str(valor).replace('\r', ' ').replace('\n', ' ')
        texto = ' '.join(texto.split())
        maxlen = fdef.get('max')
        if maxlen and len(texto) > maxlen:
            return None, f"El valor excede el máximo de {maxlen} caracteres.", None
        return texto, None, {}

    if tipo == 'numero':
        num = _to_decimal(valor)
        if num is None:
            return None, 'Valor numérico inválido.', None
        if num <= 0:
            return None, 'El valor debe ser mayor que cero.', None
        return num, None, {}

    if tipo == 'fecha':
        fecha = _to_date(valor)
        if not fecha:
            return None, 'Fecha inválida.', None
        return fecha, None, {}

    if tipo == 'select_tipo_mov':
        v = str(valor or '').strip().upper()
        if v not in ('D', 'C'):
            return None, "El tipo de movimiento debe ser 'D' o 'C'.", None
        return v, None, {}

    if tipo == 'select_cuenta':
        cod = str(valor or '').strip()
        cuenta = Cuenta.objects.filter(codigo=cod, deleted=False).first()
        if not cuenta:
            return None, f"La cuenta '{cod}' no existe.", None
        if not (cuenta.es_detalle and cuenta.is_active):
            return None, f"La cuenta '{cod}' no es de detalle o está inactiva.", None
        if tabla == 'movicont' and scope['cuentas'] is not None and cod not in scope['cuentas']:
            return None, f"La cuenta '{cod}' no está permitida para su rol.", None
        return cod, None, {}

    if tipo == 'select_centro':
        cod = str(valor or '').strip()
        if cod and not CentroCosto.objects.filter(codigo=cod, deleted=False).exists():
            return None, f"El centro de costo '{cod}' no existe.", None
        if tabla == 'movicont' and scope['centros_costo'] is not None and cod not in scope['centros_costo']:
            return None, f"El centro de costo '{cod}' no está permitido para su rol.", None
        return (cod or None), None, {}

    if tipo == 'select_cedula':
        cod = str(valor or '').strip()
        if cod and not Tercero.objects.filter(cedula=cod, deleted=False).exists():
            return None, f"El tercero con cédula '{cod}' no existe.", None
        return (cod or None), None, {}

    if tipo == 'select_comprobante':
        cod = str(valor or '').strip()
        if not Comprobante.objects.filter(codigo=cod, deleted=False).exists():
            return None, f"El comprobante '{cod}' no existe.", None
        return cod, None, {}

    return None, 'Tipo de campo no soportado.', None


def _buscar_campo(tabla, campo):
    for fdef in CAMPOS_EDITABLES.get(tabla, []):
        if fdef['campo'] == campo:
            return fdef
    return None


def _registrar_auditoria(request, tabla, filtros, total, campo, valor_db):
    try:
        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            user=request.user, action='BULK_UPDATE',
            resource=TABLAS[tabla]['modelo'], resource_id='multiple',
            before_data={'tabla': tabla, 'filtros': filtros, 'total': total},
            after_data={'campo': campo, 'valor': str(valor_db)},
            endpoint=request.path, http_method=request.method,
        )
    except Exception:
        pass


# ── Vistas ───────────────────────────────────────────────────────────────────

class _BaseCorreccion(APIView):
    permission_classes      = [IsAuthenticated, HasPermission]
    required_permission     = f'{MODULE}.acceder'

    def _validar_tabla(self, tabla):
        return tabla in TABLAS


class PreviewView(_BaseCorreccion):
    """POST { tabla, filtros } → total, muestra y definición de campos editables."""

    def post(self, request):
        tabla = request.data.get('tabla')
        if not self._validar_tabla(tabla):
            return Response({'detail': 'Tabla no válida.'}, status=status.HTTP_400_BAD_REQUEST)

        filtros = request.data.get('filtros') or {}
        qs = TABLAS[tabla]['qs'](filtros, request.user)
        total = qs.count()
        muestra = [SERIALIZADORES[tabla](r) for r in qs[:MAX_MUESTRA]]
        return Response({
            'tabla': tabla,
            'total': total,
            'columnas': COLUMNAS_MUESTRA[tabla],
            'campos_editables': CAMPOS_EDITABLES[tabla],
            'muestra': muestra,
        })


class AplicarView(_BaseCorreccion):
    """POST { tabla, filtros, campo, valor, confirmacion } → aplica en bloque."""

    def post(self, request):
        tabla = request.data.get('tabla')
        if not self._validar_tabla(tabla):
            return Response({'detail': 'Tabla no válida.'}, status=status.HTTP_400_BAD_REQUEST)

        if str(request.data.get('confirmacion') or '').strip().upper() != 'CONFIRMAR':
            return Response({'detail': 'Debe escribir CONFIRMAR para aplicar los cambios.'},
                            status=status.HTTP_400_BAD_REQUEST)

        campo = request.data.get('campo')
        fdef = _buscar_campo(tabla, campo)
        if not fdef:
            return Response({'detail': f"El campo '{campo}' no se puede modificar."},
                            status=status.HTTP_400_BAD_REQUEST)

        filtros = request.data.get('filtros') or {}
        qs = TABLAS[tabla]['qs'](filtros, request.user)
        total = qs.count()
        if total == 0:
            return Response({'detail': 'No hay registros que cumplan los filtros.'},
                            status=status.HTTP_400_BAD_REQUEST)

        scope = user_scope(request.user)
        valor_db, error, extra = _preparar_valor(tabla, fdef, request.data.get('valor'), scope)
        if error:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

        # Fecha de cierre solo aplica a movimientos contables.
        if tabla == 'movicont':
            cierre = fecha_cierre_usuario(request.user)
            if cierre is not None:
                bloqueados = qs.filter(fecha__lte=cierre).count()
                if bloqueados:
                    return Response(
                        {'detail': f"{bloqueados} registro(s) tienen fecha igual o anterior a "
                                   f"{cierre.isoformat()} (su fecha de cierre) y no pueden modificarse."},
                        status=status.HTTP_400_BAD_REQUEST)
            if campo == 'fecha':
                err_fecha = validar_fecha_cierre(request.user, valor_db,
                                                 accion='cambiar la fecha de los movimientos')
                if err_fecha:
                    return Response({'detail': err_fecha}, status=status.HTTP_400_BAD_REQUEST)

        update_kwargs = {fdef['update_key']: valor_db}
        if tabla == 'movicont' and campo == 'vr_debitos':
            update_kwargs['vr_creditos'] = 0
        elif tabla == 'movicont' and campo == 'vr_creditos':
            update_kwargs['vr_debitos'] = 0

        with transaction.atomic():
            actualizados = qs.update(
                updated_by=request.user, updated_at=timezone.now(), **update_kwargs
            )
            _registrar_auditoria(request, tabla, filtros, actualizados, campo, valor_db)

        return Response({'actualizados': actualizados, 'campo': campo,
                         'valor': str(valor_db)})
