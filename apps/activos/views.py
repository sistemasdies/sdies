from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.activos.models import Categoria, Ubicacion, EstadoActivoF, ActivoF, FotoActivoF
from apps.activos.serializers import (
    CategoriaSerializer, UbicacionSerializer, EstadoActivoFSerializer, ActivoFSerializer,
    FotoActivoFSerializer,
)
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.core.services import cloudinary_service
from apps.core.utils.exceptions import ServiceNotConfigured
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status


class CategoriaViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = CategoriaSerializer
    module = 'activos'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['categoria', 'nombre_categoria']
    ordering = ['categoria']
    queryset = Categoria.objects.all()


class UbicacionViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = UbicacionSerializer
    module = 'activos'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ubicacion', 'descripcion']
    ordering = ['ubicacion']
    queryset = Ubicacion.objects.all()


class EstadoActivoFViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = EstadoActivoFSerializer
    module = 'activos'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['estado_activo_f', 'descripcion_estado_activo_f']
    ordering = ['estado_activo_f']
    queryset = EstadoActivoF.objects.all()


class ActivoFViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = ActivoFSerializer
    module = 'activos'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['id_activo_f', 'nombre_activo_f', 'marca', 'modelo', 'numero_serie', 'comentarios']
    filterset_fields = ['categoria', 'ubicacion', 'congregacion', 'estado_actual', 'responsable']
    ordering_fields = ['id_activo_f', 'nombre_activo_f', 'fecha_adquisicion', 'valor_compra']
    ordering = ['id_activo_f']
    queryset = ActivoF.objects.all().select_related('categoria', 'ubicacion', 'congregacion', 'responsable', 'estado_actual')

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post', 'delete'], url_path='foto',
            parser_classes=[MultiPartParser, FormParser])
    def foto(self, request, pk=None):
        activo = self.get_object()
        if request.method == 'DELETE':
            foto_id = request.query_params.get('foto_id') or request.data.get('foto_id')
            if not foto_id:
                return Response({'detail': 'Debe indicar foto_id.'}, status=status.HTTP_400_BAD_REQUEST)
            foto = FotoActivoF.objects.filter(pk=foto_id, activo=activo).first()
            if not foto:
                return Response({'detail': 'Foto no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
            cloudinary_service.eliminar_foto(foto.public_id)
            foto.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        archivo = request.FILES.get('imagen')
        if not archivo:
            return Response({'detail': 'Debe adjuntar una imagen en el campo "imagen".'},
                            status=status.HTTP_400_BAD_REQUEST)
        if archivo.size > 5 * 1024 * 1024:
            return Response({'detail': 'La imagen no puede superar los 5 MB.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if archivo.content_type not in {'image/jpeg', 'image/png', 'image/webp'}:
            return Response({'detail': 'Formato no permitido. Use JPG, PNG o WEBP.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            subida = cloudinary_service.subir_foto(archivo, public_id=f'activo_{activo.id_activo_f}_{FotoActivoF.objects.filter(activo=activo).count()+1}', folder='sdies/activosf', transformar=False)
        except ServiceNotConfigured as e:
            return Response({'detail': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            return Response({'detail': 'No se pudo subir la imagen.'}, status=status.HTTP_502_BAD_GATEWAY)

        foto = FotoActivoF.objects.create(
            activo=activo,
            url=subida['secure_url'],
            public_id=subida['public_id'],
            orden=FotoActivoF.objects.filter(activo=activo).count(),
            descripcion=request.data.get('descripcion', ''),
        )
        return Response(FotoActivoFSerializer(foto).data, status=status.HTTP_201_CREATED)


class FotoActivoFViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = FotoActivoFSerializer
    module = 'activos'
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activo']
    ordering = ['orden', 'id']
    queryset = FotoActivoF.objects.all().select_related('activo')

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()