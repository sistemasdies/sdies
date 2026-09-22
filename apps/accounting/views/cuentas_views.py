from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.accounting.models import Cuenta
from apps.accounting.serializers.cuentas import CuentaSerializer, CuentaArbolSerializer
from apps.accounting.services.balance_service import BalanceService
from apps.core.utils.pagination import StandardPagination
from apps.users.services.scopes import user_scope



class CuentaViewSet(viewsets.ModelViewSet):
    serializer_class   = CuentaSerializer
    module             = 'plan_cuentas'
    permission_classes = [IsAuthenticated]
    pagination_class   = StandardPagination
    search_fields      = ['codigo', 'descripcion']
    ordering_fields    = ['codigo', 'descripcion', 'nivel']

    def get_queryset(self):
        qs = Cuenta.objects.filter(deleted=False).select_related('padre')
        p  = self.request.query_params
        if p.get('nivel'):        qs = qs.filter(nivel=p['nivel'])
        if p.get('solo_detalle'): qs = qs.filter(es_detalle=True)
        if p.get('activas'):      qs = qs.filter(is_active=True)
        scope = user_scope(self.request.user)
        if scope['cuentas'] is not None:
            qs = qs.filter(codigo__in=scope['cuentas'])
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=False, methods=['get'])
    def arbol(self, request):
        qs = Cuenta.objects.filter(
            padre__isnull=True, deleted=False, is_active=True
        )
        scope = user_scope(request.user)
        if scope['cuentas'] is not None:
            qs = qs.filter(codigo__in=scope['cuentas'])
        raices = qs.order_by('codigo')
        return Response(CuentaArbolSerializer(raices, many=True).data)

    @action(detail=True, methods=['get'])
    def saldo(self, request, pk=None):
        cuenta = self.get_object()
        data   = BalanceService.saldo_cuenta(
            cuenta.codigo,
            request.query_params.get('fecha_desde'),
            request.query_params.get('fecha_hasta'),
        )
        return Response(data)

    @action(detail=True, methods=['get'])
    def hijos(self, request, pk=None):
        cuenta = self.get_object()
        hijos  = cuenta.hijos.filter(deleted=False).order_by('codigo')
        return Response(CuentaSerializer(hijos, many=True,
                        context={'request': request}).data)