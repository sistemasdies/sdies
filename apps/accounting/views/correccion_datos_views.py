"""Corrección masiva de datos (Procesos → Corrección de Datos).

Permite seleccionar un subconjunto de registros mediante filtros y
sobrescribir un único campo en todos ellos. El servidor re-evalúa los filtros,
valida el nuevo valor y registra el cambio en la bitácora (AuditLog).
"""
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

from django.apps import apps as django_apps
from django.db import models, transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models.base import BaseModel
from apps.core.permissions import HasPermission
from apps.accounting.models import (
    CentroCosto, Comprobante, Cuenta, DetallePlantilla, MoviCont,
    PlantillaContable, Tercero,
)
from apps.membresia.models import Membresia, EstadoMembresia
from apps.congregacion.models import Congregacion
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
        {'campo': 'cedula',       'label': 'Código (tercero)','tipo': 'select_cedula',      'update_key': 'cedula_id'},
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
        {'campo': 'cedula',       'label': 'Código',           'tipo': 'select_cedula',   'update_key': 'cedula'},
        {'campo': 'centro_costo', 'label': 'Centro de costo',  'tipo': 'select_centro',   'update_key': 'centro_costo'},
        {'campo': 'comentarios',  'label': 'Comentarios',      'tipo': 'texto', 'max': 200, 'update_key': 'comentarios'},
        {'campo': 'doc_soporte',  'label': 'Doc. soporte',     'tipo': 'texto', 'max': 15,  'update_key': 'doc_soporte'},
    ],
    'terceros': [
        {'campo': 'tipo_persona',   'label': 'Tipo persona',    'tipo': 'select_tipo_persona', 'update_key': 'tipo_persona'},
        {'campo': 'nombre1',        'label': 'Primer nombre',   'tipo': 'texto', 'max': 50,  'update_key': 'nombre1'},
        {'campo': 'nombre2',        'label': 'Segundo nombre',  'tipo': 'texto', 'max': 50,  'update_key': 'nombre2'},
        {'campo': 'apellido1',      'label': 'Primer apellido', 'tipo': 'texto', 'max': 50,  'update_key': 'apellido1'},
        {'campo': 'apellido2',      'label': 'Segundo apellido','tipo': 'texto', 'max': 50,  'update_key': 'apellido2'},
        {'campo': 'razon_social',   'label': 'Razón social',    'tipo': 'texto', 'max': 200, 'update_key': 'razon_social'},
        {'campo': 'direccion',      'label': 'Dirección',       'tipo': 'texto', 'max': 200, 'update_key': 'direccion'},
        {'campo': 'barrio',         'label': 'Barrio',          'tipo': 'texto', 'max': 50,  'update_key': 'barrio'},
        {'campo': 'codigo_postal',  'label': 'Código postal',   'tipo': 'texto', 'max': 6,   'update_key': 'codigo_postal'},
        {'campo': 'distrito',       'label': 'Distrito',        'tipo': 'texto', 'max': 2,   'update_key': 'distrito'},
        {'campo': 'telefono1',      'label': 'Teléfono',        'tipo': 'texto', 'max': 30,  'update_key': 'telefono1'},
        {'campo': 'celular',        'label': 'Celular',         'tipo': 'texto', 'max': 20,  'update_key': 'celular'},
        {'campo': 'email',          'label': 'Correo',          'tipo': 'texto', 'max': 80,  'update_key': 'email'},
        {'campo': 'fecha_nacimiento','label': 'Fecha nacimiento','tipo': 'fecha',            'update_key': 'fecha_nacimiento'},
        {'campo': 'lugar_nacimiento','label': 'Lugar nacimiento','tipo': 'texto', 'max': 100,'update_key': 'lugar_nacimiento'},
        {'campo': 'sexo',           'label': 'Sexo',            'tipo': 'select_sexo',        'update_key': 'sexo'},
        {'campo': 'tipo_sangre',    'label': 'Tipo sangre',     'tipo': 'texto', 'max': 3,   'update_key': 'tipo_sangre'},
        {'campo': 'comentarios',    'label': 'Comentarios',     'tipo': 'texto', 'max': 2000,'update_key': 'comentarios'},
        {'campo': 'is_active',      'label': 'Activo',          'tipo': 'booleano',           'update_key': 'is_active'},
    ],
    'membresia': [
        {'campo': 'tipo_sangre',              'label': 'Tipo sangre',            'tipo': 'texto', 'max': 3,   'update_key': 'tipo_sangre'},
        {'campo': 'estado_civil',             'label': 'Estado civil',           'tipo': 'select_estado_civil',  'update_key': 'estado_civil'},
        {'campo': 'fecha_matrimonio',         'label': 'Fecha matrimonio',       'tipo': 'fecha',                 'update_key': 'fecha_matrimonio'},
        {'campo': 'tipo_matrimonio',          'label': 'Tipo matrimonio',        'tipo': 'select_tipo_matrimonio','update_key': 'tipo_matrimonio'},
        {'campo': 'lugar_matrimonio',         'label': 'Lugar matrimonio',       'tipo': 'texto', 'max': 30,     'update_key': 'lugar_matrimonio'},
        {'campo': 'nombre_oficiado_por',      'label': 'Oficiado por',           'tipo': 'texto', 'max': 30,     'update_key': 'nombre_oficiado_por'},
        {'campo': 'nombre_papa',              'label': 'Nombre padre',           'tipo': 'texto', 'max': 30,     'update_key': 'nombre_papa'},
        {'campo': 'nombre_mama',              'label': 'Nombre madre',           'tipo': 'texto', 'max': 30,     'update_key': 'nombre_mama'},
        {'campo': 'nombre_conyuge',           'label': 'Nombre cónyuge',         'tipo': 'texto', 'max': 30,     'update_key': 'nombre_conyuge'},
        {'campo': 'personas_a_cargo',         'label': 'Personas a cargo',       'tipo': 'numero',                'update_key': 'personas_a_cargo'},
        {'campo': 'comentario_familiar',      'label': 'Comentario familiar',    'tipo': 'texto', 'max': 2000,   'update_key': 'comentario_familiar'},
        {'campo': 'folio_reg_civil',          'label': 'Folio reg. civil',       'tipo': 'texto', 'max': 12,     'update_key': 'folio_reg_civil'},
        {'campo': 'oficina_reg_civil',        'label': 'Oficina reg. civil',     'tipo': 'texto', 'max': 30,     'update_key': 'oficina_reg_civil'},
        {'campo': 'escolaridad',              'label': 'Escolaridad',            'tipo': 'texto', 'max': 30,     'update_key': 'escolaridad'},
        {'campo': 'profesion',                'label': 'Profesión',              'tipo': 'texto', 'max': 30,     'update_key': 'profesion'},
        {'campo': 'ocupacion',                'label': 'Ocupación',              'tipo': 'texto', 'max': 30,     'update_key': 'ocupacion'},
        {'campo': 'lugar_de_trabajo',         'label': 'Lugar trabajo',          'tipo': 'texto', 'max': 30,     'update_key': 'lugar_de_trabajo'},
        {'campo': 'telefono_trabajo',         'label': 'Teléfono trabajo',       'tipo': 'texto', 'max': 20,     'update_key': 'telefono_trabajo'},
        {'campo': 'comentarios_academico_laboral','label': 'Comentarios acad./lab.','tipo': 'texto', 'max': 2000,'update_key': 'comentarios_academico_laboral'},
        {'campo': 'estado',                   'label': 'Estado membresía',       'tipo': 'select_estado_membresia','update_key': 'estado_id'},
        {'campo': 'comentarios_eclesiales',   'label': 'Comentarios eclesiales', 'tipo': 'texto', 'max': 2000,   'update_key': 'comentarios_eclesiales'},
        {'campo': 'congregacion',             'label': 'Congregación',           'tipo': 'select_congregacion',   'update_key': 'congregacion_id'},
        {'campo': 'sw_bautizado',             'label': 'Bautizado',              'tipo': 'booleano',              'update_key': 'sw_bautizado'},
        {'campo': 'fecha_bautismo',           'label': 'Fecha bautismo',         'tipo': 'fecha',                 'update_key': 'fecha_bautismo'},
        {'campo': 'lugar_bautismo',           'label': 'Lugar bautismo',         'tipo': 'texto', 'max': 30,     'update_key': 'lugar_bautismo'},
        {'campo': 'pastor_que_bautizo',       'label': 'Pastor bautizo',         'tipo': 'texto', 'max': 30,     'update_key': 'pastor_que_bautizo'},
        {'campo': 'sw_promesado',             'label': 'Promesado',              'tipo': 'booleano',              'update_key': 'sw_promesado'},
        {'campo': 'fecha_promesado',          'label': 'Fecha promesado',        'tipo': 'fecha',                 'update_key': 'fecha_promesado'},
        {'campo': 'lugar_promesado',          'label': 'Lugar promesado',        'tipo': 'texto', 'max': 30,     'update_key': 'lugar_promesado'},
        {'campo': 'congregacion_anterior',    'label': 'Congregación anterior',  'tipo': 'texto', 'max': 30,     'update_key': 'congregacion_anterior'},
        {'campo': 'salio_para',               'label': 'Salió para',             'tipo': 'texto', 'max': 30,     'update_key': 'salio_para'},
        {'campo': 'fecha_llegada',            'label': 'Fecha llegada',          'tipo': 'fecha',                 'update_key': 'fecha_llegada'},
        {'campo': 'fecha_salida',             'label': 'Fecha salida',           'tipo': 'fecha',                 'update_key': 'fecha_salida'},
    ],
}

COLUMNAS_MUESTRA = {
    'movicont': [
        {'key': 'cod_comprob', 'label': 'Comprob.'}, {'key': 'num_comprob', 'label': 'Número'},
        {'key': 'item_comprob', 'label': 'Ítem'}, {'key': 'fecha', 'label': 'Fecha'},
        {'key': 'cuenta', 'label': 'Cuenta'}, {'key': 'cedula', 'label': 'Código'},
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
        {'key': 'cedula', 'label': 'Código'}, {'key': 'centro_costo', 'label': 'C. Costo'},
        {'key': 'comentarios', 'label': 'Comentarios'},
    ],
    'terceros': [
        {'key': 'cedula', 'label': 'Cédula'}, {'key': 'nombre_completo', 'label': 'Nombre'},
        {'key': 'tipo_persona', 'label': 'Tipo'}, {'key': 'direccion', 'label': 'Dirección'},
        {'key': 'barrio', 'label': 'Barrio'}, {'key': 'telefono1', 'label': 'Teléfono'},
        {'key': 'celular', 'label': 'Celular'}, {'key': 'email', 'label': 'Correo'},
        {'key': 'sexo', 'label': 'Sexo'}, {'key': 'is_active', 'label': 'Activo'},
    ],
    'membresia': [
        {'key': 'cedula', 'label': 'Cédula'}, {'key': 'nombre_completo', 'label': 'Nombre'},
        {'key': 'estado', 'label': 'Estado'}, {'key': 'congregacion', 'label': 'Congregación'},
        {'key': 'estado_civil', 'label': 'E. Civil'}, {'key': 'telefono_trabajo', 'label': 'Tel. Trabajo'},
        {'key': 'profesion', 'label': 'Profesión'}, {'key': 'ocupacion', 'label': 'Ocupación'},
        {'key': 'sw_bautizado', 'label': 'Baut.'}, {'key': 'sw_promesado', 'label': 'Prom.'},
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


def _qs_terceros(filtros, user):
    qs = Tercero.objects.filter(deleted=False)
    f = filtros or {}
    if f.get('cedula'):
        qs = qs.filter(cedula__icontains=f['cedula'])
    if f.get('tipo_persona'):
        qs = qs.filter(tipo_persona=f['tipo_persona'])
    for key in ('nombre1', 'nombre2', 'apellido1', 'apellido2', 'razon_social'):
        if f.get(key):
            qs = qs.filter(**{f'{key}__icontains': f[key]})
    if f.get('direccion'):
        qs = qs.filter(direccion__icontains=f['direccion'])
    if f.get('barrio'):
        qs = qs.filter(barrio__icontains=f['barrio'])
    if f.get('email'):
        qs = qs.filter(email__icontains=f['email'])
    if f.get('telefono1'):
        qs = qs.filter(telefono1__icontains=f['telefono1'])
    if f.get('celular'):
        qs = qs.filter(celular__icontains=f['celular'])
    if f.get('sexo'):
        qs = qs.filter(sexo=f['sexo'])
    return qs.order_by('apellido1', 'nombre1')


def _qs_membresia(filtros, user):
    qs = Membresia.objects.filter(deleted=False).select_related('tercero', 'estado', 'congregacion')
    f = filtros or {}
    if f.get('cedula'):
        qs = qs.filter(tercero__cedula__icontains=f['cedula'])
    if f.get('nombre'):
        qs = qs.filter(
            models.Q(tercero__nombre1__icontains=f['nombre']) |
            models.Q(tercero__nombre2__icontains=f['nombre']) |
            models.Q(tercero__apellido1__icontains=f['nombre']) |
            models.Q(tercero__apellido2__icontains=f['nombre'])
        )
    if f.get('estado'):
        qs = qs.filter(estado__estado=f['estado'])
    if f.get('congregacion'):
        qs = qs.filter(congregacion__codigo=f['congregacion'])
    if f.get('estado_civil'):
        qs = qs.filter(estado_civil=f['estado_civil'])
    if f.get('sw_bautizado') in (True, 'true', 'True', '1'):
        qs = qs.filter(sw_bautizado=True)
    elif f.get('sw_bautizado') in (False, 'false', 'False', '0'):
        qs = qs.filter(sw_bautizado=False)
    if f.get('sw_promesado') in (True, 'true', 'True', '1'):
        qs = qs.filter(sw_promesado=True)
    elif f.get('sw_promesado') in (False, 'false', 'False', '0'):
        qs = qs.filter(sw_promesado=False)
    return qs.order_by('tercero__apellido1', 'tercero__nombre1')


TABLAS = {
    'movicont':       {'qs': _qs_movicont,       'modelo': 'MoviCont'},
    'plantillas':     {'qs': _qs_plantillas,     'modelo': 'PlantillaContable'},
    'det_plantillas': {'qs': _qs_det_plantillas, 'modelo': 'DetallePlantilla'},
    'terceros':       {'qs': _qs_terceros,       'modelo': 'Tercero'},
    'membresia':      {'qs': _qs_membresia,      'modelo': 'Membresia'},
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


def _ser_tercero(t):
    return {
        'cedula': t.cedula,
        'nombre_completo': t.nombre_completo,
        'tipo_persona': t.tipo_persona,
        'nombre1': t.nombre1, 'nombre2': t.nombre2,
        'apellido1': t.apellido1, 'apellido2': t.apellido2,
        'razon_social': t.razon_social,
        'direccion': t.direccion, 'barrio': t.barrio,
        'codigo_postal': t.codigo_postal, 'distrito': t.distrito,
        'telefono1': t.telefono1, 'celular': t.celular, 'email': t.email,
        'fecha_nacimiento': t.fecha_nacimiento.isoformat() if t.fecha_nacimiento else '',
        'lugar_nacimiento': t.lugar_nacimiento,
        'sexo': t.sexo, 'tipo_sangre': t.tipo_sangre,
        'comentarios': t.comentarios,
        'is_active': 'Sí' if t.is_active else 'No',
    }


def _ser_membresia(m):
    return {
        'cedula': m.tercero_id,
        'nombre_completo': m.tercero.nombre_completo,
        'tipo_sangre': m.tipo_sangre,
        'estado_civil': m.estado_civil,
        'fecha_matrimonio': m.fecha_matrimonio.isoformat() if m.fecha_matrimonio else '',
        'tipo_matrimonio': m.tipo_matrimonio,
        'lugar_matrimonio': m.lugar_matrimonio,
        'nombre_oficiado_por': m.nombre_oficiado_por,
        'nombre_papa': m.nombre_papa, 'nombre_mama': m.nombre_mama,
        'nombre_conyuge': m.nombre_conyuge,
        'personas_a_cargo': m.personas_a_cargo,
        'comentario_familiar': m.comentario_familiar,
        'folio_reg_civil': m.folio_reg_civil,
        'oficina_reg_civil': m.oficina_reg_civil,
        'escolaridad': m.escolaridad,
        'profesion': m.profesion,
        'ocupacion': m.ocupacion,
        'lugar_de_trabajo': m.lugar_de_trabajo,
        'telefono_trabajo': m.telefono_trabajo,
        'comentarios_academico_laboral': m.comentarios_academico_laboral,
        'estado': m.estado_id or '',
        'comentarios_eclesiales': m.comentarios_eclesiales,
        'congregacion': m.congregacion_id or '',
        'sw_bautizado': 'Sí' if m.sw_bautizado else 'No',
        'fecha_bautismo': m.fecha_bautismo.isoformat() if m.fecha_bautismo else '',
        'lugar_bautismo': m.lugar_bautismo,
        'pastor_que_bautizo': m.pastor_que_bautizo,
        'sw_promesado': 'Sí' if m.sw_promesado else 'No',
        'fecha_promesado': m.fecha_promesado.isoformat() if m.fecha_promesado else '',
        'lugar_promesado': m.lugar_promesado,
        'congregacion_anterior': m.congregacion_anterior,
        'salio_para': m.salio_para,
        'fecha_llegada': m.fecha_llegada.isoformat() if m.fecha_llegada else '',
        'fecha_salida': m.fecha_salida.isoformat() if m.fecha_salida else '',
    }


SERIALIZADORES = {
    'movicont': _ser_movicont,
    'plantillas': _ser_plantilla,
    'det_plantillas': _ser_detalle,
    'terceros': _ser_tercero,
    'membresia': _ser_membresia,
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

    if tipo == 'select_tipo_persona':
        v = str(valor or '').strip().upper()
        if v not in ('N', 'J'):
            return None, "El tipo de persona debe ser 'N' (Natural) o 'J' (Jurídica).", None
        return v, None, {}

    if tipo == 'select_sexo':
        v = str(valor or '').strip().upper()
        if v not in ('M', 'F'):
            return None, "El sexo debe ser 'M' o 'F'.", None
        return v, None, {}

    if tipo == 'select_estado_civil':
        v = str(valor or '').strip()
        if v not in ('1', '2', '3', '4', '5', '6'):
            return None, "Estado civil no válido.", None
        return v, None, {}

    if tipo == 'select_tipo_matrimonio':
        v = str(valor or '').strip().upper()
        if v not in ('C', 'J', 'R', 'A', 'B'):
            return None, "Tipo de matrimonio no válido.", None
        return v, None, {}

    if tipo == 'select_estado_membresia':
        v = str(valor or '').strip()
        if not EstadoMembresia.objects.filter(estado=v).exists():
            return None, f"El estado de membresía '{v}' no existe.", None
        return v, None, {}

    if tipo == 'select_congregacion':
        v = str(valor or '').strip()
        if v and not Congregacion.objects.filter(codigo=v, deleted=False).exists():
            return None, f"La congregación '{v}' no existe.", None
        return v or None, None, {}

    if tipo == 'booleano':
        return bool(valor in (True, 'true', 'True', '1', 'Sí', 'SI', 'si')), None, {}

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


# ── Borrado Duro (eliminación física de registros con borrado suave) ─────────

class _BaseCorreccion(APIView):
    permission_classes      = [IsAuthenticated, HasPermission]
    required_permission     = f'{MODULE}.acceder'

    def _validar_tabla(self, tabla):
        return tabla in TABLAS


def _orden_borrado():
    """Todos los modelos BaseModel, ordenados para eliminar primero los registros
    referenciados (hijos) y dejar para el final las tablas que otros referencian."""
    modelos = [m for m in django_apps.get_models()
               if issubclass(m, BaseModel) and not m._meta.abstract and not m._meta.proxy]
    conjunto = set(modelos)
    referencias = {m: set() for m in modelos}
    for m in modelos:
        for campo in m._meta.fields:
            if isinstance(campo, models.ForeignKey) and campo.related_model in conjunto:
                referencias[m].add(campo.related_model)

    visitados = set()
    orden = []

    def visitar(m):
        if m in visitados:
            return
        visitados.add(m)
        orden.append(m)
        for ref in referencias[m]:
            visitar(ref)

    for m in modelos:
        visitar(m)
    return orden


class BorradoDuroView(_BaseCorreccion):
    """GET: conteo por tabla de registros con borrado suave.
    POST { confirmacion: 'BORRAR' }: los elimina físicamente de todas las tablas."""

    def get(self, request):
        por_tabla = []
        total = 0
        for m in _orden_borrado():
            n = m.all_objects.filter(deleted=True).count()
            if n:
                por_tabla.append({
                    'tabla': m.__name__,
                    'etiqueta': m._meta.verbose_name_plural,
                    'cantidad': n,
                })
                total += n
        return Response({'total': total, 'por_tabla': por_tabla})

    def post(self, request):
        if str(request.data.get('confirmacion') or '').strip().upper() != 'BORRAR':
            return Response({'detail': 'Debe escribir BORRAR para ejecutar el borrado duro.'},
                            status=status.HTTP_400_BAD_REQUEST)

        reporte = []
        total_eliminados = 0
        total_protegidos = 0
        with transaction.atomic():
            for modelo in _orden_borrado():
                pks = list(modelo.all_objects.filter(deleted=True).values_list('pk', flat=True))
                eliminados = 0
                protegidos = 0
                for pk in pks:
                    try:
                        modelo.all_objects.get(pk=pk).delete()
                        eliminados += 1
                    except ProtectedError:
                        protegidos += 1
                if eliminados or protegidos:
                    reporte.append({
                        'tabla': modelo.__name__,
                        'eliminados': eliminados,
                        'protegidos': protegidos,
                    })
                total_eliminados += eliminados
                total_protegidos += protegidos

        try:
            from apps.audit.models import AuditLog
            AuditLog.objects.create(
                user=request.user, action='BORRADO_DURO',
                resource='todas', resource_id='multiple',
                before_data={'por_tabla': reporte},
                after_data={'total_eliminados': total_eliminados,
                            'total_protegidos': total_protegidos},
                endpoint=request.path, http_method=request.method,
            )
        except Exception:
            pass

        return Response({
            'total_eliminados': total_eliminados,
            'total_protegidos': total_protegidos,
            'por_tabla': reporte,
        })


# ── Vistas ───────────────────────────────────────────────────────────────────

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
