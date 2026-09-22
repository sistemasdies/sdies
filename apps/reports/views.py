import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.reports.services.balance_sheet import ReportService
from apps.reports.services.auxiliares import auxiliares, CAMPOS_ORDEN
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
        return Response(ReportService.balance_general(fecha_hasta))


class EstadoResultadosView(APIView):
    module             = 'reportes'
    permission_classes = [IsAuthenticated]
    def get(self, request):
        today       = datetime.date.today()
        fecha_desde = request.query_params.get('fecha_desde', f"{today.year}-01-01")
        fecha_hasta = request.query_params.get('fecha_hasta', str(today))
        return Response(ReportService.estado_resultados(fecha_desde, fecha_hasta))


class BalanceComprobacionView(APIView):
    module             = 'reportes'
    permission_classes = [IsAuthenticated]
    def get(self, request):
        today       = datetime.date.today()
        fecha_desde = request.query_params.get('fecha_desde', f"{today.year}-01-01")
        fecha_hasta = request.query_params.get('fecha_hasta', str(today))
        return Response(BalanceService.balance_comprobacion(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            libros=_multi(request.query_params, 'libro'),
            cuentas=_multi(request.query_params, 'cuenta'),
            centros=_multi(request.query_params, 'centro'),
            nivel=request.query_params.get('nivel', 4),
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