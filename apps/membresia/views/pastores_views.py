from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.membresia.models import Pastor
from apps.membresia.serializers.pastores import PastorSerializer
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin


class PastorViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = PastorSerializer
    module             = 'pastores'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['codigo_pastor__cedula', 'nombre_pastor_postulante',
                          'comentarios']
    filterset_fields   = ['codigo_pastor']
    ordering_fields    = ['codigo_pastor', 'nombre_pastor_postulante', 'created_at']
    ordering           = ['codigo_pastor']
    queryset           = Pastor.objects.all().select_related('codigo_pastor')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)