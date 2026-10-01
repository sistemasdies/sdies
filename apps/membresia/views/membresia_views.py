from django.db.models import Q
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounting.models import Tercero
from apps.membresia.models import Membresia
from apps.membresia.serializers.membresia import (
    MembresiaSerializer, TerceroReferenciaSerializer,
)
from apps.core.utils.pagination import StandardPagination


class MembresiaViewSet(viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = MembresiaSerializer
    module             = 'membresias'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['tercero__cedula', 'tercero__nombre1', 'tercero__nombre2',
                          'tercero__apellido1', 'tercero__apellido2',
                          'tercero__razon_social', 'tercero__celular',
                          'congregacion__codigo', 'congregacion__nombre']
    filterset_fields   = ['estado', 'sw_bautizado', 'sw_promesado', 'estado_civil',
                          'congregacion']
    ordering_fields    = ['tercero__cedula', 'tercero__apellido1', 'tercero__nombre1',
                          'created_at', 'estado', 'fecha_bautismo', 'fecha_llegada']
    ordering           = ['tercero__apellido1', 'tercero__nombre1']
    queryset           = Membresia.objects.filter(deleted=False).select_related(
                             'tercero', 'congregacion')

    def get_queryset(self):
        qs = super().get_queryset()
        p  = self.request.query_params
        if p.get('solo_bautizados') == '1': qs = qs.filter(sw_bautizado=True)
        if p.get('solo_promesados') == '1': qs = qs.filter(sw_promesado=True)
        if p.get('q'):
            termino = p['q'].strip()
            qs = qs.filter(
                Q(tercero__cedula__icontains=termino)
                | Q(tercero__nombre1__icontains=termino)
                | Q(tercero__apellido1__icontains=termino)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='cedulas-con-membresia')
    def cedulas_con_membresia(self, request):
        """Cédulas que ya tienen membresía, para marcarlas en el buscador de terceros."""
        return Response(sorted(Membresia.objects.values_list('tercero_id', flat=True)))

    @action(detail=False, methods=['get'], url_path='tercero-por-cedula')
    def tercero_por_cedula(self, request):
        """Busca un tercero por cédula exacta para precargar la sección 1."""
        cedula = (request.query_params.get('cedula') or '').strip()
        if not cedula:
            return Response({'detail': 'Debe indicar la cédula.'}, status=400)

        tercero = Tercero.all_objects.filter(cedula=cedula).first()
        if tercero is None:
            return Response({'existe': False, 'tercero': None, 'ya_tiene_membresia': False})

        previa = Membresia.all_objects.filter(tercero_id=cedula).first()
        return Response({
            'existe':             True,
            'tercero':            TerceroReferenciaSerializer(tercero).data,
            'ya_tiene_membresia': previa is not None and not previa.deleted,
            'membresia_dada_de_baja': previa is not None and previa.deleted,
        })
