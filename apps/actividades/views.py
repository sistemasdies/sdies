from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import F

from apps.actividades.models import Acontecimiento, FotoAcontecimiento, Asistencia
from apps.actividades.serializers import (
    AcontecimientoSerializer, FotoAcontecimientoSerializer, AsistenciaSerializer,
)
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.core.services import cloudinary_service
from apps.core.utils.exceptions import ServiceNotConfigured
from apps.audit.mixins import AuditMixin
from apps.users.services.scopes import user_scope


class AcontecimientoViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = AcontecimientoSerializer
    module = 'acontecimientos'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['congregacion', 'fecha']
    search_fields = ['titulo', 'comentarios', 'congregacion__codigo', 'congregacion__nombre']
    ordering_fields = ['fecha', 'congregacion', 'item']
    ordering = ['-fecha', 'congregacion', 'item']
    queryset = Acontecimiento.objects.all().select_related('congregacion').prefetch_related('fotos')

    def get_queryset(self):
        qs = super().get_queryset()
        scope = user_scope(self.request.user)
        if scope['congregaciones'] is not None:
            qs = qs.filter(congregacion__codigo__in=scope['congregaciones'])
        return qs

    def perform_create(self, serializer):
        serializer.save()
        self._log('create', serializer.instance, before=None, after=self._snapshot(serializer.instance))

    def perform_update(self, serializer):
        before = self._snapshot(serializer.instance)
        serializer.save()
        self._log('update', serializer.instance, before=before, after=self._snapshot(serializer.instance))

    def _nombre_foto(self, acontecimiento, numero):
        return f"{acontecimiento.congregacion_id}_{acontecimiento.item:04d}_{numero:02d}"

    @action(detail=True, methods=['post'], url_path='fotos',
            parser_classes=[MultiPartParser, FormParser])
    def subir_fotos(self, request, pk=None):
        acontecimiento = self.get_object()
        archivos = request.FILES.getlist('imagen')
        if not archivos:
            return Response({'detail': 'Debe adjuntar al menos una imagen en el campo "imagen".'},
                            status=status.HTTP_400_BAD_REQUEST)

        count_actual = acontecimiento.fotos.count()
        if count_actual + len(archivos) > 10:
            return Response(
                {'detail': f'Solo se permiten 10 fotos. Actualmente tiene {count_actual}.'},
                status=status.HTTP_400_BAD_REQUEST)

        creadas = []
        errores = []
        for archivo in archivos:
            count_actual += 1
            if count_actual > 10:
                break
            public_id = self._nombre_foto(acontecimiento, count_actual)
            try:
                subida = cloudinary_service.subir_foto(
                    archivo,
                    public_id=public_id,
                    folder='sdies/acontecimientos',
                    transformar=False,
                )
                foto = FotoAcontecimiento.objects.create(
                    acontecimiento=acontecimiento,
                    url=subida['secure_url'],
                    public_id=subida['public_id'],
                    orden=count_actual,
                    descripcion=request.data.get('descripcion', ''),
                )
                creadas.append(FotoAcontecimientoSerializer(foto).data)
            except ServiceNotConfigured as e:
                errores.append(str(e))
            except Exception:
                errores.append(f'No se pudo subir {archivo.name}.')

        return Response({'creadas': creadas, 'errores': errores}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='fotos/(?P<foto_id>[^/.]+)')
    def eliminar_foto(self, request, pk=None, foto_id=None):
        acontecimiento = self.get_object()
        foto = acontecimiento.fotos.filter(pk=foto_id).first()
        if not foto:
            return Response({'detail': 'Foto no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if foto.public_id:
            try:
                cloudinary_service.eliminar_foto(foto.public_id)
            except Exception:
                pass
        foto.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AsistenciaViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = AsistenciaSerializer
    module = 'asistencia'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['congregacion', 'fecha']
    search_fields = ['comentarios', 'tema_predicacion', 'congregacion__codigo', 'congregacion__nombre']
    ordering_fields = ['fecha', 'congregacion']
    ordering = ['-fecha', 'congregacion']
    queryset = Asistencia.objects.all().select_related('congregacion')

    def get_queryset(self):
        qs = super().get_queryset()
        scope = user_scope(self.request.user)
        if scope['congregaciones'] is not None:
            qs = qs.filter(congregacion__codigo__in=scope['congregaciones'])
        # Permitir ordenar por el total calculado
        ordering = self.request.query_params.get('ordering', '')
        campo = ordering.lstrip('-')
        if campo == 'total':
            qs = qs.annotate(
                total=F('creyentes') + F('simpatizantes') + F('visitas') + F('ninos')
            )
        return qs

    def perform_create(self, serializer):
        serializer.save()
        self._log('create', serializer.instance, before=None, after=self._snapshot(serializer.instance))

    def perform_update(self, serializer):
        before = self._snapshot(serializer.instance)
        serializer.save()
        self._log('update', serializer.instance, before=before, after=self._snapshot(serializer.instance))
