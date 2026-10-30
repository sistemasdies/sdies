import datetime

from django.conf import settings
from django.http import StreamingHttpResponse, HttpResponse
from django.template.loader import render_to_string
from django.utils.timezone import now

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from apps.reports.services import backup
from django.shortcuts import get_object_or_404
from apps.membresia.models import Membresia, EstadoCivil, TipoMatrimonio, EstadoMembresia
from apps.organizacion.models.datos_generales import DatosGenerales
from apps.reports.services.balance_sheet import ReportService
from apps.reports.services.auxiliares import auxiliares, CAMPOS_ORDEN
from apps.reports.services.comparativo import comparativo_meses, PeriodoInvalido
from apps.accounting.services.balance_service import BalanceService
from apps.users.services.scopes import user_scope
from apps.users.services.role_context import es_superusuario_efectivo


def _multi(p, key):
    vals = []
    for v in p.getlist(key):
        vals.extend(x.strip() for x in v.split(',') if x.strip())
    return vals


def _fecha(request, key):
    texto = (request.query_params.get(key) or '').strip()
    if not texto:
        return None
    try:
        return datetime.datetime.strptime(texto, '%Y-%m-%d').date()
    except ValueError:
        return None


class BalanceGeneralView(APIView):
    module             = 'reportes'
    permission_classes = [IsAuthenticated]
    def get(self, request):
        fecha_hasta = request.query_params.get('fecha_hasta', str(datetime.date.today()))
        scope = user_scope(request.user)
        return Response(ReportService.balance_general(
            fecha_hasta, solo_cuentas=scope['cuentas'],
            solo_centros=scope['centros_costo'],
            solo_comprobantes=scope['comprobantes']))


class EstadoResultadosView(APIView):
    module             = 'reportes'
    permission_classes = [IsAuthenticated]
    def get(self, request):
        today       = datetime.date.today()
        fecha_desde = request.query_params.get('fecha_desde', f"{today.year}-01-01")
        fecha_hasta = request.query_params.get('fecha_hasta', str(today))
        excluir_cierre = request.query_params.get('excluir_cierre', '').lower() in ('1', 'true', 'si', 'yes')
        scope = user_scope(request.user)
        return Response(ReportService.estado_resultados(
            fecha_desde, fecha_hasta, excluir_cierre=excluir_cierre,
            solo_cuentas=scope['cuentas'], solo_centros=scope['centros_costo'],
            solo_comprobantes=scope['comprobantes']))


class BalanceComprobacionView(APIView):
    module             = 'reportes'
    permission_classes = [IsAuthenticated]
    def get(self, request):
        today       = datetime.date.today()
        fecha_desde = request.query_params.get('fecha_desde', f"{today.year}-01-01")
        fecha_hasta = request.query_params.get('fecha_hasta', str(today))
        scope = user_scope(request.user)
        return Response(BalanceService.balance_comprobacion(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            libros=_multi(request.query_params, 'libro'),
            cuentas=_multi(request.query_params, 'cuenta'),
            centros=_multi(request.query_params, 'centro'),
            nivel=request.query_params.get('nivel', 4),
            solo_cuentas=scope['cuentas'],
            solo_centros=scope['centros_costo'],
            solo_comprobantes=scope['comprobantes'],
        ))


class AuxiliaresView(APIView):
    module             = 'reportes'
    permission_classes = [IsAuthenticated]

    def get(self, request):
        p = request.query_params
        fecha_desde = _fecha(request, 'fecha_desde')
        fecha_hasta = _fecha(request, 'fecha_hasta')
        if not fecha_hasta:
            fecha_hasta = datetime.date.today()

        orden1 = (p.get('orden1') or 'fecha').lower()
        orden2 = (p.get('orden2') or 'cuenta').lower()
        orden3 = (p.get('orden3') or 'cedula').lower()

        scope = user_scope(request.user)

        data = auxiliares(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            cuentas=_multi(p, 'cuenta'),
            centros=_multi(p, 'centro_costo'),
            comprobantes=_multi(p, 'comprobante'),
            cedulas=_multi(p, 'cedula'),
            orden1=orden1 if orden1 in CAMPOS_ORDEN else 'fecha',
            orden2=orden2 if orden2 in CAMPOS_ORDEN else 'cuenta',
            orden3=orden3 if orden3 in CAMPOS_ORDEN else 'cedula',
            saldos_iniciales=(p.get('saldos_iniciales', 'no') == 'si'),
            subtotales_cedula=(p.get('subtotales_cedula', 'no') == 'si'),
            solo_cuentas=scope['cuentas'],
            solo_centros=scope['centros_costo'],
            solo_comprobantes=scope['comprobantes'],
        )
        return Response(data)


class ComparativoMesesView(APIView):
    module             = 'reportes'
    permission_classes = [IsAuthenticated]

    def get(self, request):
        p = request.query_params
        scope = user_scope(request.user)
        agrupacion = 'anio' if (p.get('agrupacion') or 'mes').lower() == 'anio' else 'mes'
        hoy = datetime.date.today()
        inicio = p.get('inicio') or None
        if not inicio:
            inicio = f'{hoy.year:04d}' if agrupacion == 'anio' else f'{hoy.year:04d}-{hoy.month:02d}'
        try:
            data = comparativo_meses(
                inicio=inicio,
                cuentas=_multi(p, 'cuenta'),
                centros=_multi(p, 'centro_costo'),
                comprobantes=_multi(p, 'comprobante'),
                cedulas=_multi(p, 'cedula'),
                detalle_terceros=(p.get('detalle_terceros', 'no') == 'si'),
                solo_cuentas=scope['cuentas'],
                solo_centros=scope['centros_costo'],
                solo_comprobantes=scope['comprobantes'],
                agrupacion=agrupacion,
            )
        except PeriodoInvalido as e:
            return Response({'detail': str(e)}, status=400)
        return Response(data)


class ExportarReporteView(APIView):
    module             = 'reportes'
    permission_classes = [IsAuthenticated]
    def post(self, request):
        tipo    = request.data.get('tipo')
        formato = request.data.get('formato', 'pdf')
        desde   = request.data.get('fecha_desde')
        hasta   = request.data.get('fecha_hasta', str(datetime.date.today()))
        email   = request.data.get('email', request.user.email)
        if not tipo:
            return Response({'error': 'El campo tipo es requerido.'}, status=400)
        from apps.reports.tasks import generar_reporte_pdf, generar_reporte_excel
        from celery.exceptions import CeleryError
        task   = generar_reporte_pdf if formato == 'pdf' else generar_reporte_excel
        try:
            result = task.delay(tipo, desde, hasta, email)
            return Response({'task_id': result.id, 'estado': 'encolado', 'email': email})
        except (CeleryError, OSError):
            task.run(tipo, desde, hasta, email)
            return Response({'estado': 'ok', 'email': email})


class IsSuperUser(BasePermission):
    message = 'Solo el superusuario puede gestionar copias de seguridad.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and es_superusuario_efectivo(request.user))


class BackupExportView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        incluir_media = request.query_params.get('incluir_media', 'false').lower() == 'true'
        timestamp = now().strftime('%Y%m%d_%H%M%S')

        try:
            ruta_sql = backup.crear_dump_temporal()
        except backup.BackupError as e:
            return Response({'detail': str(e)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if incluir_media:
            nombre_sql = f'sdies_backup_{timestamp}.sql'
            try:
                ruta = backup.crear_zip_temporal(
                    ruta_sql, nombre_sql, getattr(settings, 'MEDIA_ROOT', None),
                )
            except Exception as e:
                return Response({'detail': f'No se pudo crear el archivo .zip: {e}'},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            response = StreamingHttpResponse(backup.leer_y_borrar(ruta),
                                             content_type='application/zip')
            response['Content-Disposition'] = (
                f'attachment; filename="sdies_backup_completo_{timestamp}.zip"'
            )
        else:
            response = StreamingHttpResponse(backup.gzip_y_borrar(ruta_sql),
                                             content_type='application/gzip')
            response['Content-Disposition'] = (
                f'attachment; filename="sdies_backup_{timestamp}.sql.gz"'
            )

        response['Cache-Control'] = 'no-store'
        return response


class BackupImportView(APIView):
    permission_classes = [IsSuperUser]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        if 'archivo' not in request.FILES:
            return Response(
                {'detail': 'Archivo requerido: archivo (.sql, .sql.gz o .zip)'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        archivo = request.FILES['archivo']
        nombre = (archivo.name or '').lower()

        if not nombre.endswith(('.sql', '.sql.gz', '.zip')):
            return Response(
                {'detail': 'Formato inválido. Usa .sql, .sql.gz o .zip'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            salida = backup.restaurar_desde_archivo(archivo)
        except backup.BackupError as e:
            return Response({'detail': str(e)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'detail': 'Restauración completada con éxito.',
            'salida': salida[:2000],
        })

class FichaMembresiaView(APIView):
    module = 'reportes'
    permission_classes = [IsAuthenticated]

    def get(self, request):
        mid = request.query_params.get('id')
        if not mid:
            return Response({'detail': 'Debe indicar id de la membresia.'}, status=status.HTTP_400_BAD_REQUEST)
        m = get_object_or_404(Membresia, pk=mid)
        t = m.tercero
        org = DatosGenerales.get_solo()
        context = {
            'fecha_hoy': datetime.date.today(),
            'org_nombre': org.NombreOrganizacion,
            'org_logo': org.LogoDeLaOrganizacion,
            'nombre_completo': m.nombre_completo,
            'membresia_id': str(m.id),
            'foto': m.foto or '',
            'org_logo': org.LogoDeLaOrganizacion,
            'org_nombre': org.NombreOrganizacion,
            'tipo_documento': t.tipo_documento,
            'cedula': t.cedula,
            'fecha_nacimiento': t.fecha_nacimiento,
            'lugar_nacimiento': t.lugar_nacimiento,
            'sexo': t.sexo,
            'sexo_label': 'Masculino' if t.sexo == 'M' else ('Femenino' if t.sexo == 'F' else t.sexo),
            'estado_civil': m.estado_civil,
            'estado_civil_label': dict(EstadoCivil.choices).get(m.estado_civil, m.estado_civil),
            'tipo_matrimonio': m.tipo_matrimonio,
            'tipo_matrimonio_label': dict(TipoMatrimonio.choices).get(m.tipo_matrimonio, m.tipo_matrimonio),
            'nombre_conyuge': m.nombre_conyuge,
            'fecha_matrimonio': m.fecha_matrimonio,
            'lugar_matrimonio': m.lugar_matrimonio,
            'nombre_oficiado_por': m.nombre_oficiado_por,
            'nombre_papa': m.nombre_papa,
            'nombre_mama': m.nombre_mama,
            'personas_a_cargo': m.personas_a_cargo,
            'estado': m.estado_id if m.estado_id else '',
            'estado_label': (m.estado.descripcion if m.estado else ''),
            'direccion': t.direccion,
            'barrio': t.barrio,
            'codigo_postal': t.codigo_postal,
            'distrito': t.distrito,
            'telefono1': t.telefono1,
            'celular': t.celular,
            'email': t.email,
            'escolaridad': m.escolaridad,
            'profesion': m.profesion,
            'ocupacion': m.ocupacion,
            'lugar_de_trabajo': m.lugar_de_trabajo,
            'telefono_trabajo': m.telefono_trabajo,
            'comentarios_academico_laboral': m.comentarios_academico_laboral,
            'congregacion': m.congregacion,
            'congregacion_nombre': (m.congregacion.nombre if m.congregacion else ''),
            'sw_bautizado': m.sw_bautizado,
            'serial_bautismo': m.serial_bautismo,
            'fecha_bautismo': m.fecha_bautismo,
            'lugar_bautismo': m.lugar_bautismo,
            'pastor_que_bautizo': m.pastor_que_bautizo,
            'sw_promesado': m.sw_promesado,
            'serial_membresia': m.serial_membresia,
            'fecha_promesado': m.fecha_promesado,
            'lugar_promesado': m.lugar_promesado,
            'congregacion_anterior': m.congregacion_anterior,
            'salio_para': m.salio_para,
            'fecha_llegada': m.fecha_llegada,
            'fecha_salida': m.fecha_salida,
            'comentarios_eclesiales': m.comentarios_eclesiales,
            'comentario_familiar': m.comentario_familiar,
            'comentarios': t.comentarios,
            'folio_reg_civil': m.folio_reg_civil,
            'fecha_fallecido': m.fecha_fallecido,
            'oficina_reg_civil': m.oficina_reg_civil,
            'lugar_fallecimiento': m.lugar_fallecimiento,
        }
        html = render_to_string('reports/ficha_membresia.html', context)
        return HttpResponse(html, content_type='text/html; charset=utf-8')
