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

        codigos = [str(r.get('codigo_cargo') or '').strip().upper() for r in registros]
        existentes = {
            c.codigo_cargo: c
            for c in Cargo.objects.filter(codigo_cargo__in=codigos)
        }

        creados = actualizados = omitidos = 0
        errores = []
        for i, dato in enumerate(registros, start=1):
            try:
                fila = int(dato.get('_fila') or i)
            except (TypeError, ValueError):
                fila = i
            codigo = str(dato.get('codigo_cargo') or '').strip().upper()
            nombre = str(dato.get('nombre_cargo') or '').strip()
            if not codigo or not nombre:
                errores.append({'fila': fila, 'codigo_cargo': codigo, 'error': 'Faltan código o nombre'})
                continue

            existente = existentes.get(codigo)
            if existente and modo == 'solo_nuevos':
                omitidos += 1
                continue
            if not existente and modo == 'reemplazar':
                omitidos += 1
                continue

            serializer = CargoSerializer(instance=existente, data={'codigo_cargo': codigo, 'nombre_cargo': nombre}, partial=True)
            if serializer.is_valid():
                if existente:
                    serializer.save()
                    actualizados += 1
                else:
                    serializer.save()
                    creados += 1
            else:
                msgs = '; '.join(f'{k}: {v[0]}' for k, v in serializer.errors.items())
                errores.append({'fila': fila, 'codigo_cargo': codigo, 'error': msgs})

        return Response({
            'creados': creados,
            'actualizados': actualizados,
            'omitidos': omitidos,
            'errores': errores,
        })
