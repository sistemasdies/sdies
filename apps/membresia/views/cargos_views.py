from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.membresia.models import Cargo
from apps.membresia.serializers.cargos import CargoSerializer
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.audit.mixins import AuditMixin


class CargoViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = CargoSerializer
    module             = 'cargos'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['codigo_cargo', 'nombre_cargo']
    filterset_fields   = []
    ordering_fields    = ['codigo_cargo', 'nombre_cargo']
    ordering           = ['codigo_cargo']
    queryset           = Cargo.objects.all()

    @action(detail=False, methods=['get'], url_path='siguiente-codigo')
    def siguiente_codigo(self, request):
        """Devuelve el siguiente código numérico disponible para un cargo."""
        max_num = 0
        for codigo in Cargo.objects.values_list('codigo_cargo', flat=True):
            try:
                n = int(str(codigo).strip())
                if n > max_num:
                    max_num = n
            except ValueError:
                continue
        return Response({'siguiente_codigo': f'{max_num + 1:02d}'})
