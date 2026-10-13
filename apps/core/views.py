from django.conf import settings
from django.db.models.deletion import ProtectedError
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.response import Response


def spa_fallback(request, path=''):
    index = getattr(settings, 'SPA_BUILD_DIR', None)
    if not index or not (index / 'index.html').exists():
        raise Http404
    return FileResponse((index / 'index.html').open('rb'), content_type='text/html')


class HardDeleteMixin:
    """Borra físicamente los registros. Si hay FKs PROTECT devuelve 400 con un mensaje claro."""

    def perform_destroy(self, instance):
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError as e:
            total = len(e.protected_objects)
            return Response(
                {'detail': 'No se puede eliminar: el registro está referenciado por '
                           f'{total} registro(s) asociado(s).'},
                status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)