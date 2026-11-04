from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
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

        codigos = [str(r.get('codigo_area') or '').strip() for r in registros]
        existentes = {
            a.codigo_area: a
            for a in AreaTrabajo.objects.filter(codigo_area__in=codigos)
        }

        creados = actualizados = omitidos = 0
        errores = []
        for i, dato in enumerate(registros, start=1):
            try:
                fila = int(dato.get('_fila') or i)
            except (TypeError, ValueError):
                fila = i
            codigo = str(dato.get('codigo_area') or '').strip()
            nombre = str(dato.get('nombre_area') or '').strip()
            if not codigo or not nombre:
                errores.append({'fila': fila, 'codigo_area': codigo, 'error': 'Faltan código o nombre'})
                continue

            existente = existentes.get(codigo)
            if existente and modo == 'solo_nuevos':
                omitidos += 1
                continue
            if not existente and modo == 'reemplazar':
                omitidos += 1
                continue

            payload = {
                'codigo_area': codigo,
                'nombre_area': nombre,
                'descripcion_area': str(dato.get('descripcion_area') or '').strip(),
                'comentarios_area': str(dato.get('comentarios_area') or '').strip(),
            }
            serializer = AreaTrabajoSerializer(instance=existente, data=payload, partial=True)
            if serializer.is_valid():
                serializer.save()
                if existente:
                    actualizados += 1
                else:
                    creados += 1
            else:
                msgs = '; '.join(f'{k}: {v[0]}' for k, v in serializer.errors.items())
                errores.append({'fila': fila, 'codigo_area': codigo, 'error': msgs})

        return Response({
            'creados': creados,
            'actualizados': actualizados,
            'omitidos': omitidos,
            'errores': errores,
        })
