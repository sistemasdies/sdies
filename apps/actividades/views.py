from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django_filters.filters import BaseInFilter
from django_filters import rest_framework as django_filters
from django.db.models import F

from apps.actividades.models import Acontecimiento, FotoAcontecimiento, Asistencia, Visitacion
from apps.actividades.serializers import (
    AcontecimientoSerializer, FotoAcontecimientoSerializer, AsistenciaSerializer, VisitacionSerializer,
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

    def perform_destroy(self, instance):
        fotos = list(instance.fotos.values_list('public_id', flat=True))
        for public_id in fotos:
            if public_id:
                try:
                    cloudinary_service.eliminar_foto(public_id)
                except Exception:
                    pass
        instance.delete()

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


class CharInFilter(BaseInFilter, django_filters.CharFilter):
    pass


class AsistenciaFilter(django_filters.FilterSet):
    congregacion = CharInFilter(field_name='congregacion__codigo', lookup_expr='in')
    fecha__gte = django_filters.DateFilter(field_name='fecha', lookup_expr='gte')
    fecha__lte = django_filters.DateFilter(field_name='fecha', lookup_expr='lte')

    class Meta:
        model = Asistencia
        fields = []


class AsistenciaViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = AsistenciaSerializer
    module = 'asistencia'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = AsistenciaFilter
    search_fields = ['comentarios', 'tema_predicacion', 'congregacion__codigo', 'congregacion__nombre']
    ordering_fields = ['fecha', 'congregacion', 'subtotal', 'total']
    ordering = ['-fecha', 'congregacion']
    queryset = Asistencia.objects.all().select_related('congregacion')

    def get_queryset(self):
        qs = super().get_queryset()
        scope = user_scope(self.request.user)
        if scope['congregaciones'] is not None:
            qs = qs.filter(congregacion__codigo__in=scope['congregaciones'])
        # Permitir ordenar por totales calculados
        ordering = self.request.query_params.get('ordering', '')
        campo = ordering.lstrip('-')
        if campo == 'total':
            qs = qs.annotate(
                total=F('creyentes') + F('simpatizantes') + F('visitas') + F('ninos')
            )
        if campo == 'subtotal':
            qs = qs.annotate(
                subtotal=F('creyentes') + F('simpatizantes') + F('visitas')
            )
        return qs

    def perform_create(self, serializer):
        serializer.save()
        self._log('create', serializer.instance, before=None, after=self._snapshot(serializer.instance))

    def perform_update(self, serializer):
        before = self._snapshot(serializer.instance)
        serializer.save()
        self._log('update', serializer.instance, before=before, after=self._snapshot(serializer.instance))


class VisitacionViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = VisitacionSerializer
    module = 'visitacion'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['congregacion', 'fecha', 'modo']
    search_fields = [
        'objeto_visita', 'comentarios',
        'visitado__tercero__cedula', 'visitado__tercero__nombre1',
        'visitado__tercero__apellido1', 'responsable__tercero__cedula',
        'responsable__tercero__nombre1', 'responsable__tercero__apellido1',
        'congregacion__codigo', 'congregacion__nombre',
    ]
    ordering_fields = ['fecha', 'congregacion', 'item']
    ordering = ['-fecha', 'congregacion', 'item']
    queryset = Visitacion.objects.all().select_related(
        'congregacion', 'visitado__tercero', 'responsable__tercero')

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
