from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.membresia.models import AreaTrabajo
from apps.membresia.serializers.areas_trabajo import AreaTrabajoSerializer
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.audit.mixins import AuditMixin


class AreaTrabajoViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = AreaTrabajoSerializer
    module             = 'areas_trabajo'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['codigo_area', 'nombre_area', 'descripcion_area']
    filterset_fields   = []
    ordering_fields    = ['codigo_area', 'nombre_area']
    ordering           = ['codigo_area']
    queryset           = AreaTrabajo.objects.all()
