from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.congregacion.models import Congregacion
from apps.congregacion.serializers.congregacion import CongregacionSerializer
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.users.services.scopes import user_scope


class CongregacionViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = CongregacionSerializer
    module             = 'congregaciones'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['codigo', 'nombre', 'direccion',
                          'pastor__cedula', 'pastor__nombre1', 'pastor__nombre2',
                          'pastor__apellido1', 'pastor__apellido2', 'pastor__razon_social']
    filterset_fields   = ['pastor']
    ordering_fields    = ['codigo', 'nombre', 'direccion', 'created_at']
    ordering           = ['codigo']
    queryset           = Congregacion.objects.filter(deleted=False).select_related('pastor')

    def get_queryset(self):
        qs = super().get_queryset()
        scope = user_scope(self.request.user)
        if scope['congregaciones'] is not None:
            qs = qs.filter(codigo__in=scope['congregaciones'])
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
