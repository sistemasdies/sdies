"""Exportación de datos maestros a CSV.

Las columnas y su orden coinciden con las plantillas de importación
(pantalla "Importar Datos"), de modo que el CSV exportado se puede volver
a importar sin ajustes.
"""
import csv
import datetime
import io
import zipfile

from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import ModulePermission
from apps.accounting.models import (
    CentroCosto, Comprobante, Cuenta, DetallePlantilla, MoviCont,
    PlantillaContable, Tercero,
)
from apps.accounting.views.terceros_views import EXPORT_COLUMNAS
from apps.membresia.import_export import (
    CAMPOS_MEMBRESIA, valor_exportacion,
)
from apps.membresia.models import Membresia

MODULE = 'exportar'


def _clean(valor):
    if valor is None:
        return ''
    if isinstance(valor, str):
        return valor.replace('\r', ' ').replace('\n', ' ')
    return valor


def _csv_text(headers, rows):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return '\ufeff' + buf.getvalue()


def _cuentas():
    headers = ['codigo', 'descripcion']
    rows = ([c.codigo, _clean(c.descripcion)]
            for c in Cuenta.objects.order_by('codigo'))
    return headers, rows


def _terceros():
    headers = [h for h, _ in EXPORT_COLUMNAS]
    rows = ([_clean(getattr(t, campo)) for _, campo in EXPORT_COLUMNAS]
            for t in Tercero.objects.order_by('apellido1', 'nombre1', 'razon_social'))
    return headers, rows


def _membresias():
    headers = list(CAMPOS_MEMBRESIA)
    qs = (Membresia.objects
          .select_related('tercero', 'congregacion')
          .order_by('tercero__apellido1', 'tercero__nombre1'))
    rows = ([valor_exportacion(m, campo) for campo in CAMPOS_MEMBRESIA]
            for m in qs.iterator())
    return headers, rows


def _centros_costo():
    headers = ['codigo', 'descripcion', 'responsable']
    rows = ([c.codigo, _clean(c.descripcion), c.responsable_id or '']
            for c in CentroCosto.objects.order_by('codigo'))
    return headers, rows


def _comprobantes():
    headers = ['codigo', 'descripcion', 'numero_inicial', 'activo']
    rows = ([c.codigo, _clean(c.descripcion),
             c.numero_inicial if c.numero_inicial is not None else '',
             'true' if c.activo else 'false']
            for c in Comprobante.objects.order_by('codigo'))
    return headers, rows


def _movicont():
    headers = ['CodComprob', 'NumComprob', 'ItemComprob', 'Cuenta', 'DocRef',
               'Observacion', 'Cedula', 'CentroCosto', 'DocSoporte',
               'VrDebitos', 'VrCreditos', 'Fecha']
    qs = (MoviCont.objects
          .select_related('cod_comprob', 'cuenta', 'cedula', 'centro_costo')
          .order_by('fecha', 'num_comprob', 'item_comprob'))
    rows = ([
        m.cod_comprob_id,
        m.num_comprob,
        m.item_comprob,
        m.cuenta_id,
        _clean(m.doc_ref),
        _clean(m.observacion),
        m.cedula_id or '',
        m.centro_costo_id or '',
        _clean(m.doc_soporte),
        m.vr_debitos,
        m.vr_creditos,
        m.fecha.strftime('%Y-%m-%d') if m.fecha else '',
    ] for m in qs.iterator())
    return headers, rows


def _plantillas():
    headers = ['cod_plantilla', 'nombre', 'descripcion', 'comprobante']
    rows = ([p.cod_plantilla, _clean(p.nombre), _clean(p.descripcion),
             p.comprobante_id or '']
            for p in PlantillaContable.objects.order_by('cod_plantilla'))
    return headers, rows


def _detalle_plantillas():
    headers = ['cod_plantilla', 'item', 'cuenta', 'doc_ref', 'observacion',
               'tipo_mov', 'valor', 'base', 'cedula', 'centro_costo',
               'comentarios', 'doc_soporte']
    qs = (DetallePlantilla.objects
          .select_related('plantilla')
          .order_by('plantilla__cod_plantilla', 'item'))
    rows = ([
        d.plantilla.cod_plantilla,
        d.item,
        _clean(d.cuenta),
        _clean(d.doc_ref),
        _clean(d.observacion),
        _clean(d.tipo_mov),
        _clean(d.valor),
        _clean(d.base),
        _clean(d.cedula),
        _clean(d.centro_costo),
        _clean(d.comentarios),
        _clean(d.doc_soporte),
    ] for d in qs)
    return headers, rows


# Orden idéntico a las pestañas de "Importar Datos".
ENTIDADES = {
    'cuentas':        ('plan_de_cuentas.csv',    _cuentas),
    'terceros':       ('terceros.csv',           _terceros),
    'membresias':     ('membresias.csv',         _membresias),
    'centros_costo':  ('centros_de_costo.csv',   _centros_costo),
    'comprobantes':   ('comprobantes.csv',       _comprobantes),
    'movicont':       ('movicont.csv',           _movicont),
    'plantillas':     ('plantillas.csv',         _plantillas),
    'det_plantillas': ('detalle_plantillas.csv', _detalle_plantillas),
}


class BaseExportarView(APIView):
    module             = MODULE
    permission_classes = [IsAuthenticated, ModulePermission]


class ExportarDatosView(BaseExportarView):
    def get(self, request, entidad):
        item = ENTIDADES.get(entidad)
        if not item:
            return Response(
                {'detail': f'Entidad desconocida: {entidad}'},
                status=status.HTTP_404_NOT_FOUND)
        nombre, builder = item
        headers, rows = builder()
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{nombre}"'
        response['Cache-Control'] = 'no-cache'
        response.write(_csv_text(headers, rows))
        return response


class ExportarTodoView(BaseExportarView):
    def get(self, request):
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, 'w', zipfile.ZIP_DEFLATED) as zf:
            for _, (nombre, builder) in ENTIDADES.items():
                headers, rows = builder()
                zf.writestr(nombre, _csv_text(headers, rows).encode('utf-8'))
        bio.seek(0)
        stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        response = HttpResponse(bio.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = (
            f'attachment; filename="exportar_datos_{stamp}.zip"')
        response['Cache-Control'] = 'no-cache'
        return response
