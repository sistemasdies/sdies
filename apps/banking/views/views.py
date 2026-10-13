from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin

from apps.banking.models import CuentaBancaria, TransaccionBancaria, ConciliacionBancaria
from apps.banking.serializers.serializers import (
    CuentaBancariaSerializer,
    TransaccionBancariaSerializer,
    ConciliacionBancariaSerializer,
)


class CuentaBancariaViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    serializer_class   = CuentaBancariaSerializer
    module             = 'comprobantes'
    permission_classes = [IsAuthenticated]
    search_fields      = ['nombre', 'banco', 'numero_cuenta']

    def get_queryset(self):
        return CuentaBancaria.objects.filter(deleted=False).order_by('nombre')


class TransaccionBancariaViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    serializer_class   = TransaccionBancariaSerializer
    module             = 'comprobantes'
    permission_classes = [IsAuthenticated]
    pagination_class   = StandardPagination

    def get_queryset(self):
        qs = TransaccionBancaria.objects.filter(deleted=False).order_by('-fecha')
        p  = self.request.query_params
        if p.get('cuenta'):  qs = qs.filter(cuenta_bancaria_id=p['cuenta'])
        if p.get('estado'):  qs = qs.filter(estado=p['estado'])
        if p.get('desde'):   qs = qs.filter(fecha__gte=p['desde'])
        if p.get('hasta'):   qs = qs.filter(fecha__lte=p['hasta'])
        return qs


class ConciliacionBancariaViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    serializer_class   = ConciliacionBancariaSerializer
    module             = 'comprobantes'
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ConciliacionBancaria.objects.filter(deleted=False).order_by('-created_at')
