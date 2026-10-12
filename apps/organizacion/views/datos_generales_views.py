from rest_framework import generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS

from apps.core.permissions import ModulePermission
from apps.organizacion.models import DatosGenerales
from apps.organizacion.serializers.datos_generales import DatosGeneralesSerializer


class DatosGeneralesView(generics.RetrieveUpdateAPIView):
    """Registro único de datos generales de la organización.

    GET  → devuelve los datos (crea el registro vacío la primera vez).
    PUT/PATCH → actualiza; acepta JSON o multipart/form-data (imágenes).

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
