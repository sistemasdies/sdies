import datetime
import gzip
import io
import os
import subprocess
import tempfile
import zipfile
import zlib

from django.conf import settings
from django.http import StreamingHttpResponse
from django.utils.timezone import now

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from apps.reports.services.balance_sheet import ReportService
from apps.reports.services.auxiliares import auxiliares, CAMPOS_ORDEN
from apps.reports.services.comparativo import comparativo_meses, PeriodoInvalido
from apps.accounting.services.balance_service import BalanceService
from apps.users.services.scopes import user_scope


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


def _gzip_stream(fileobj, chunk_size=64 * 1024):
    comp = zlib.compressobj(9, zlib.DEFLATED, 31)
    while True:
        chunk = fileobj.read(chunk_size)
        if not chunk:
            break
        data = comp.compress(chunk)
        if data:
            yield data
    tail = comp.flush()
    if tail:
        yield tail


class IsSuperUser(BasePermission):
    message = 'Solo el superusuario puede gestionar copias de seguridad.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class BackupExportView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        incluir_media = request.query_params.get('incluir_media', 'false').lower() == 'true'

        db = settings.DATABASES['default']
        host = db.get('HOST') or 'localhost'
        port = db.get('PORT') or '5432'
        user = db.get('USER') or ''
        name = db.get('NAME') or ''
        password = db.get('PASSWORD') or ''

        timestamp = now().strftime('%Y%m%d_%H%M%S')

        env = os.environ.copy()
        if password:
            env['PGPASSWORD'] = str(password)

        dump_cmd = [
            'pg_dump',
            '-h', str(host),
            '-p', str(port),
            '-U', str(user),
            '-d', str(name),
            '--format=plain',
            '--no-owner',
            '--no-privileges',
        ]
        db_filename = f'sdies_backup_{timestamp}.sql.gz'

        try:
            dump_proc = subprocess.Popen(dump_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        except FileNotFoundError as e:
            return Response({'detail': f'pg_dump no encontrado. Verifica la instalación en el servidor. Error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not incluir_media:
            response = StreamingHttpResponse(_gzip_stream(dump_proc.stdout), content_type='application/gzip')
            response['Content-Disposition'] = f'attachment; filename="{db_filename}"'
            response['Cache-Control'] = 'no-cache'
            return response

        bio = io.BytesIO()
        with zipfile.ZipFile(bio, 'w', zipfile.ZIP_DEFLATED) as zf:
            sql_gz_bytes = b''.join(_gzip_stream(dump_proc.stdout))
            zf.writestr(db_filename, sql_gz_bytes)
            media_root = getattr(settings, 'MEDIA_ROOT', None)
            if media_root and os.path.exists(media_root):
                for root, dirs, files in os.walk(media_root):
                    for f in files:
                        full = os.path.join(root, f)
                        arc = os.path.relpath(full, media_root)
                        try:
                            zf.write(full, os.path.join('media', arc))
                        except Exception:
                            pass
        bio.seek(0)
        response = StreamingHttpResponse(io.BytesIO(bio.getvalue()), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="sdies_backup_completo_{timestamp}.zip"'
        response['Cache-Control'] = 'no-cache'
        return response


class BackupImportView(APIView):
    permission_classes = [IsSuperUser]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        if 'archivo' not in request.FILES:
            return Response({'detail': 'Archivo requerido: archivo (.sql o .sql.gz)'}, status=status.HTTP_400_BAD_REQUEST)

        archivo = request.FILES['archivo']
        nombre = archivo.name.lower()

        if not (nombre.endswith('.sql') or nombre.endswith('.sql.gz')):
            return Response({'detail': 'Formato inválido. Usa .sql o .sql.gz'}, status=status.HTTP_400_BAD_REQUEST)

        db = settings.DATABASES['default']
        host = db.get('HOST') or 'localhost'
        port = db.get('PORT') or '5432'
        user = db.get('USER') or ''
        name = db.get('NAME') or ''
        password = db.get('PASSWORD') or ''

        env = os.environ.copy()
        if password:
            env['PGPASSWORD'] = str(password)

        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                fpath = os.path.join(tmpdir, archivo.name)
                with open(fpath, 'wb') as f:
                    for chunk in archivo.chunks():
                        f.write(chunk)

                sql_path = fpath
                if nombre.endswith('.sql.gz'):
                    sql_path = os.path.join(tmpdir, archivo.name[:-3])
                    with gzip.open(fpath, 'rb') as gz:
                        data = gz.read()
                    with open(sql_path, 'wb') as f:
                        f.write(data)

                cmd = [
                    'psql',
                    '-h', str(host),
                    '-p', str(port),
                    '-U', str(user),
                    '-d', str(name),
                    '--single-transaction',
                    '-f', sql_path,
                ]
                result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, text=True)
                if result.returncode != 0:
                    return Response({'detail': 'Error al restaurar', 'stderr': result.stderr, 'stdout': result.stdout}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                return Response({'detail': 'Restauración completada con éxito', 'stdout': result.stdout}, status=status.HTTP_200_OK)
        except FileNotFoundError as e:
            return Response({'detail': f'psql no encontrado. Verifica la instalación en el servidor. Error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'detail': f'Error inesperado: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
