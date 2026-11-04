from django_filters.filters import BaseInFilter
from django_filters import rest_framework as filters
from rest_framework import viewsets, filters as drf_filters
from rest_framework.permissions import IsAuthenticated

from apps.membresia.models import EquipoTrabajo
from apps.membresia.serializers.equipos_trabajo import EquipoTrabajoSerializer
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.audit.mixins import AuditMixin
from apps.users.services.scopes import user_scope


class CharInFilter(BaseInFilter, filters.CharFilter):
    pass


class EquipoTrabajoFilter(filters.FilterSet):
    area = CharInFilter(field_name='area_trabajo__codigo_area', lookup_expr='in')
    cargo = CharInFilter(field_name='cargo__codigo_cargo', lookup_expr='in')
    congregacion = CharInFilter(field_name='congregacion__codigo', lookup_expr='in')
    responsable = CharInFilter(field_name='responsable__tercero__cedula', lookup_expr='in')

    vigencia_desde_gte = filters.DateFilter(field_name='vigencia_desde', lookup_expr='gte')
    vigencia_desde_lte = filters.DateFilter(field_name='vigencia_desde', lookup_expr='lte')
    vigencia_hasta_gte = filters.DateFilter(field_name='vigencia_hasta', lookup_expr='gte')
    vigencia_hasta_lte = filters.DateFilter(field_name='vigencia_hasta', lookup_expr='lte')

    class Meta:
        model = EquipoTrabajo
        fields = []


class EquipoTrabajoViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = EquipoTrabajoSerializer
    module             = 'equipos_trabajo'
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    search_fields      = [
        'area_trabajo__codigo_area', 'area_trabajo__nombre_area',
        'cargo__codigo_cargo', 'cargo__nombre_cargo',
        'congregacion__codigo', 'congregacion__nombre',
        'responsable__tercero__cedula', 'responsable__tercero__nombre1',
        'responsable__tercero__apellido1',
    ]
    filterset_class    = EquipoTrabajoFilter
    ordering_fields    = [
        'area_trabajo__codigo_area', 'area_trabajo__nombre_area',
        'cargo__codigo_cargo', 'cargo__nombre_cargo',
        'congregacion__nombre', 'congregacion__codigo',
        'responsable__tercero__apellido1',
        'vigencia_desde', 'vigencia_hasta', 'created_at',
    ]
    ordering           = ['area_trabajo__codigo_area', 'cargo__codigo_cargo']
    queryset           = EquipoTrabajo.objects.filter(deleted=False).select_related(
        'area_trabajo', 'cargo', 'congregacion', 'responsable', 'responsable__tercero')

    def get_queryset(self):
        qs = super().get_queryset()
        scope = user_scope(self.request.user)
        if scope['congregaciones'] is not None:
            qs = qs.filter(congregacion__codigo__in=scope['congregaciones'])
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
