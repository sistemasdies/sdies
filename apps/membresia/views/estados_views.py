from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.membresia.models import EstadoMembresia
from apps.membresia.serializers.estados import EstadoMembresiaSerializer
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin


class EstadoMembresiaViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = EstadoMembresiaSerializer
    module             = 'estados'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['estado', 'descripcion']
    filterset_fields   = []
    ordering_fields    = ['estado', 'descripcion']
    ordering           = ['estado']
    queryset           = EstadoMembresia.objects.all()

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()
