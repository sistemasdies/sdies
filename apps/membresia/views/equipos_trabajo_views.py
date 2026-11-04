from django_filters.filters import BaseInFilter
from django_filters import rest_framework as filters
from rest_framework import viewsets, filters as drf_filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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

    @action(detail=False, methods=['post'], url_path='importar')
    def importar(self, request):
        modo = request.data.get('modo')
        registros = request.data.get('registros')
        if modo not in ('solo_nuevos', 'reemplazar', 'ambos'):
            return Response(
                {'detail': "Modo inválido. Use: 'solo_nuevos', 'reemplazar' o 'ambos'."},
                status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(registros, list) or not registros:
            return Response({'detail': 'No se recibieron registros.'},
                            status=status.HTTP_400_BAD_REQUEST)

        ids = []
        for r in registros:
            try:
                ids.append(int(r.get('id')))
            except (TypeError, ValueError):
                pass
        existentes = {
            e.id: e
            for e in EquipoTrabajo.objects.filter(id__in=ids)
        }

        creados = actualizados = omitidos = 0
        errores = []
        for i, dato in enumerate(registros, start=1):
            try:
                fila = int(dato.get('_fila') or i)
            except (TypeError, ValueError):
                fila = i

            try:
                pk = int(dato.get('id') or '')
            except (TypeError, ValueError):
                pk = None

            payload = {
                'area_trabajo': str(dato.get('area_trabajo') or '').strip() or None,
                'cargo': str(dato.get('cargo') or '').strip() or None,
                'congregacion': str(dato.get('congregacion') or '').strip() or None,
                'responsable': str(dato.get('responsable') or '').strip() or None,
                'vigencia_desde': str(dato.get('vigencia_desde') or '').strip() or None,
                'vigencia_hasta': str(dato.get('vigencia_hasta') or '').strip() or None,
                'comentarios': str(dato.get('comentarios') or '').strip(),
            }

            existente = existentes.get(pk) if pk else None
            if existente and modo == 'solo_nuevos':
                omitidos += 1
                continue
            if not existente and pk and modo == 'reemplazar':
                omitidos += 1
                continue
            if not existente and modo == 'reemplazar' and not pk:
                omitidos += 1
                continue

            serializer = EquipoTrabajoSerializer(instance=existente, data=payload, partial=True)
            if serializer.is_valid():
                save_kwargs = {'updated_by': request.user}
                if not existente:
                    save_kwargs['created_by'] = request.user
                serializer.save(**save_kwargs)
                if existente:
                    actualizados += 1
                else:
                    creados += 1
            else:
                msgs = '; '.join(f'{k}: {v[0]}' for k, v in serializer.errors.items())
                errores.append({'fila': fila, 'error': msgs})

        return Response({
            'creados': creados,
            'actualizados': actualizados,
            'omitidos': omitidos,
            'errores': errores,
        })

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
