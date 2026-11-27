from datetime import date
from decimal import Decimal
from dateutil.relativedelta import relativedelta

from django.db.models import Sum, F, Q
from django.db.models.functions import Coalesce
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.core.permissions import ModulePermission
from apps.accounting.models import Cuenta, CentroCosto, MoviCont
from .models import Presupuesto
from .serializers import PresupuestoSerializer, GenerarPresupuestoSerializer


class PresupuestoViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = PresupuestoSerializer
    module = 'presupuesto'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['anio', 'cuenta', 'centro_costo']
    search_fields = ['cuenta__codigo', 'cuenta__descripcion', 'centro_costo__codigo', 'centro_costo__nombre']
    ordering_fields = ['anio', 'cuenta__codigo', 'centro_costo__codigo', 'monto_mensual']
    ordering = ['cuenta__codigo', 'centro_costo__codigo']
    queryset = Presupuesto.objects.all().select_related('cuenta', 'centro_costo')

    def get_permissions(self):
        if self.action in {'control', 'generar', 'reiniciar'}:
            return [ModulePermission()]
        return super().get_permissions()

    @action(detail=False, methods=['post'], url_path='generar')
    def generar(self, request):
        s = GenerarPresupuestoSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        anio = s.validated_data['anio']
        porcentaje_incremento = Decimal(s.validated_data.get('porcentaje_incremento') or 0)
        fecha_desde = s.validated_data['fecha_desde']
        fecha_hasta = s.validated_data['fecha_hasta']
        centros_costo = s.validated_data.get('centros_costo') or []

        meses_historicos = max(1, (fecha_hasta.year - fecha_desde.year) * 12 + fecha_hasta.month - fecha_desde.month + 1)

        # Solo cuentas clase 4 (Ingresos) y 5 (Gastos)
        cuentas = Cuenta.objects.filter(deleted=False, es_detalle=True, clase_aptig__in=['I', 'G'])
        ccs = CentroCosto.objects.filter(deleted=False, is_active=True)
        if centros_costo:
            ccs = ccs.filter(codigo__in=centros_costo)

        # Movimientos históricos filtrados
        mov_filter = Q(fecha__gte=fecha_desde, fecha__lte=fecha_hasta)
        if centros_costo:
            mov_filter &= Q(centro_costo__codigo__in=centros_costo)

        movimientos = MoviCont.objects.filter(mov_filter).values(
            'cuenta__codigo', 'centro_costo__codigo'
        ).annotate(
            debitos=Coalesce(Sum('vr_debitos'), Decimal('0')),
            creditos=Coalesce(Sum('vr_creditos'), Decimal('0')),
        )

        # Diccionario de ejecutado histórico
        historico = {}
        for m in movimientos:
            key = (m['cuenta__codigo'], m['centro_costo__codigo'])
            historico[key] = {'debitos': m['debitos'], 'creditos': m['creditos']}

        # Borrar presupuesto existente del año (borrado duro)
        Presupuesto.all_objects.filter(anio=anio).delete()

        creados = 0
        for cuenta in cuentas:
            for cc in ccs:
                key = (cuenta.codigo, cc.codigo)
                hist = historico.get(key, {'debitos': Decimal('0'), 'creditos': Decimal('0')})

                # Saldo real según naturaleza de la cuenta
                if cuenta.naturaleza == 'D':  # Débito
                    ejecutado = hist['debitos'] - hist['creditos']
                else:  # Crédito
                    ejecutado = hist['creditos'] - hist['debitos']

                promedio_mensual = abs(ejecutado) / meses_historicos

                monto_final = promedio_mensual * (1 + porcentaje_incremento / 100)
                Presupuesto.objects.create(
                    anio=anio,
                    cuenta=cuenta,
                    centro_costo=cc,
                    monto_mensual=monto_final,
                )
                creados += 1

        return Response({'detail': f'Se generaron {creados} registros de presupuesto para el año {anio}.'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='reiniciar')
    def reiniciar(self, request):
        anio = request.data.get('anio')
        if not anio:
            return Response({'anio': ['Este campo es obligatorio.']}, status=status.HTTP_400_BAD_REQUEST)
        # Borrado duro (hard delete) de todos los registros del año, incluso los marcados como deleted.
        eliminados, _ = Presupuesto.all_objects.filter(anio=anio).delete()
        return Response({'detail': f'Presupuesto del año {anio} reiniciado. {eliminados} registro(s) eliminados.'})

    @action(detail=False, methods=['get'], url_path='control')
    def control(self, request):
        anio = request.query_params.get('anio')
        mes = request.query_params.get('mes')
        modo = request.query_params.get('modo', 'mensual')
        centros_costo = request.query_params.get('centros_costo', '')
        tope_alto = request.query_params.get('tope_alto', '110')
        tope_bajo = request.query_params.get('tope_bajo', '90')

        if not anio or not mes:
            return Response({'detail': 'anio y mes son obligatorios.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            anio = int(anio)
            mes = int(mes)
            tope_alto = Decimal(tope_alto)
            tope_bajo = Decimal(tope_bajo)
        except (ValueError, TypeError):
            return Response({'detail': 'Parámetros numéricos inválidos.'}, status=status.HTTP_400_BAD_REQUEST)

        if modo not in ('mensual', 'acumulado'):
            return Response({'detail': 'modo debe ser mensual o acumulado.'}, status=status.HTTP_400_BAD_REQUEST)

        fecha_inicio_mes = date(anio, mes, 1)
        if modo == 'acumulado':
            fecha_desde = date(anio, 1, 1)
        else:
            fecha_desde = fecha_inicio_mes
        fecha_hasta = fecha_inicio_mes + relativedelta(months=1, days=-1)

        factor_meses = mes if modo == 'acumulado' else 1

        presupuestos = Presupuesto.objects.filter(anio=anio).select_related('cuenta', 'centro_costo')
        if centros_costo:
            presupuestos = presupuestos.filter(centro_costo__codigo__in=centros_costo.split(','))

        # Ejecutado real
        mov_filter = Q(fecha__gte=fecha_desde, fecha__lte=fecha_hasta)
        if centros_costo:
            mov_filter &= Q(centro_costo__codigo__in=centros_costo.split(','))

        ejecutado = MoviCont.objects.filter(mov_filter).values(
            'cuenta__codigo', 'centro_costo__codigo'
        ).annotate(
            debitos=Coalesce(Sum('vr_debitos'), Decimal('0')),
            creditos=Coalesce(Sum('vr_creditos'), Decimal('0')),
        )

        ejecutado_dict = {}
        for e in ejecutado:
            key = (e['cuenta__codigo'], e['centro_costo__codigo'])
            ejecutado_dict[key] = {'debitos': e['debitos'], 'creditos': e['creditos']}

        resultado = []
        for p in presupuestos:
            cuenta = p.cuenta
            cc = p.centro_costo
            key = (cuenta.codigo, cc.codigo)

            real = ejecutado_dict.get(key, {'debitos': Decimal('0'), 'creditos': Decimal('0')})
            if cuenta.naturaleza == 'D':
                real_ejecutado = real['debitos'] - real['creditos']
            else:
                real_ejecutado = real['creditos'] - real['debitos']
            real_ejecutado = abs(real_ejecutado)

            presupuesto_a_comparar = p.monto_mensual * factor_meses
            # Ingresos (cuentas 4...): variación positiva = ejecución por encima del presupuesto.
            # Gastos (cuentas 5...): se conserva el signo original (presupuesto - real).
            if cuenta.codigo.startswith('4'):
                variacion = real_ejecutado - presupuesto_a_comparar
            else:
                variacion = presupuesto_a_comparar - real_ejecutado

            porcentaje = Decimal('0')
            if presupuesto_a_comparar > 0:
                porcentaje = (real_ejecutado / presupuesto_a_comparar) * 100

            # Alertas
            if porcentaje == 0:
                # Sin porcentaje, decide el signo de la variación:
                # positiva = comportamiento favorable, negativa = desfavorable.
                alerta = 'rojo' if variacion < 0 else 'verde'
            elif cuenta.codigo.startswith('4'):
                # Ingresos: rojo < 75%, naranja < 90%, verde >= 90%
                if porcentaje < Decimal('75'):
                    alerta = 'rojo'
                elif porcentaje < Decimal('90'):
                    alerta = 'naranja'
                else:
                    alerta = 'verde'
            else:
                # Gastos: verde <= 90%, naranja > 90%, rojo > 100%
                if porcentaje > Decimal('100'):
                    alerta = 'rojo'
                elif porcentaje > Decimal('90'):
                    alerta = 'naranja'
                else:
                    alerta = 'verde'

            resultado.append({
                'cuenta': cuenta.codigo,
                'cuenta_nombre': cuenta.descripcion,
                'centro_costo': cc.codigo,
                'centro_costo_nombre': cc.descripcion,
                'clase': cuenta.clase_aptig,
                'presupuesto_mensual': p.monto_mensual,
                'factor_meses': factor_meses,
                'presupuesto_a_comparar': presupuesto_a_comparar,
                'real_a_comparar': real_ejecutado,
                'variacion': variacion,
                'porcentaje_ejecucion': porcentaje,
                'alerta': alerta,
            })

        return Response({
            'anio': anio,
            'mes': mes,
            'modo': modo,
            'fecha_desde': fecha_desde,
            'fecha_hasta': fecha_hasta,
            'tope_alto': tope_alto,
            'tope_bajo': tope_bajo,
            'items': resultado,
        })
