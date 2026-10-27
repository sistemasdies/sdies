from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.membresia.models import AnotacionPastor, AnotacionMisionero
from apps.membresia.serializers.anotaciones import (
    AnotacionPastorSerializer, AnotacionMisioneroSerializer,
)
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin


class AnotacionPastorViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = AnotacionPastorSerializer
    module             = 'membresias'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['anotacion', 'cedula__cedula']
    filterset_fields   = ['cedula']
    ordering_fields    = ['fecha', 'created_at']
    ordering           = ['-fecha', '-created_at']
    queryset           = AnotacionPastor.objects.all().select_related('cedula', 'cedula_firma')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class AnotacionMisioneroViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = AnotacionMisioneroSerializer
    module             = 'membresias'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['anotacion', 'cedula__cedula']
    filterset_fields   = ['cedula']
    ordering_fields    = ['fecha', 'created_at']
    ordering           = ['-fecha', '-created_at']
    queryset           = AnotacionMisionero.objects.all().select_related('cedula', 'cedula_firma')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)