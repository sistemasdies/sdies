from django.conf import settings
from rest_framework import generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response

from apps.core.permissions import ModulePermission
from apps.core.services import cloudinary_service
from apps.core.utils.exceptions import ServiceNotConfigured
from apps.organizacion.models import DatosGenerales
from apps.organizacion.serializers.datos_generales import DatosGeneralesSerializer


class DatosGeneralesView(generics.RetrieveUpdateAPIView):
    """Registro único de datos generales de la organización.

    GET  → devuelve los datos (crea el registro vacío la primera vez).
    PUT/PATCH → actualiza; acepta JSON o multipart/form-data.

    La lectura está disponible para cualquier usuario autenticado (marca/menú);
    la edición exige el permiso del módulo datos_generales.
    """
    serializer_class   = DatosGeneralesSerializer
    module             = 'datos_generales'
    permission_classes = [IsAuthenticated, ModulePermission]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_object(self):
        return DatosGenerales.get_solo()

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class CloudinaryImagenesView(generics.GenericAPIView):
    """Lista las imágenes disponibles en una carpeta de Cloudinary.

    GET /api/datos-generales/imagenes-cloudinary/?tipo=logos|fondos
    """
    permission_classes = [IsAuthenticated]

    CARPETAS = {
        'logos':  lambda: settings.CLOUDINARY_FOLDER_LOGOS,
        'fondos': lambda: settings.CLOUDINARY_FOLDER_FONDOS,
    }

    def get(self, request):
        tipo = request.query_params.get('tipo')
        if tipo not in self.CARPETAS:
            return Response(
                {'detail': 'Tipo inválido. Use "logos" o "fondos".'},
                status=400)

        carpeta = self.CARPETAS[tipo]()
        try:
            imagenes = cloudinary_service.listar_imagenes(carpeta)
        except ServiceNotConfigured as e:
            return Response({'detail': str(e)}, status=503)
        except Exception:
            return Response(
                {'detail': 'No se pudieron listar las imágenes de Cloudinary.'},
                status=502)

        return Response({'carpeta': carpeta, 'imagenes': imagenes})
