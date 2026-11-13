from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from apps.accounting.models import CentroCosto
from apps.accounting.serializers.centros_costo import CentroCostoSerializer
from apps.core.views import HardDeleteMixin
from apps.core.import_export import importar_masivo
from apps.users.services.scopes import user_scope


class CentroCostoViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = None
    serializer_class   = CentroCostoSerializer
    module             = 'centros_costo'
    permission_classes = [IsAuthenticated]
    search_fields      = ['codigo','descripcion']
    queryset           = CentroCosto.objects.filter(deleted=False).order_by('codigo')
    def get_queryset(self):
        qs = CentroCosto.objects.filter(deleted=False).order_by('codigo')
        scope = user_scope(self.request.user)
        if scope['centros_costo'] is not None:
            qs = qs.filter(codigo__in=scope['centros_costo'])
        return qs
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='importar')
    def importar(self, request):
        scope = user_scope(request.user)
        prefiltro = None
        if scope['centros_costo'] is not None:
            prefiltro = CentroCosto.objects.filter(codigo__in=scope['centros_costo'])
        return importar_masivo(
            request.data.get('registros', []),
            CentroCosto,
            CentroCostoSerializer,
            'codigo',
            request,
            prefiltro_qs=prefiltro,
            save_kwargs_create={'created_by': request.user},
            save_kwargs_update={'updated_by': request.user},
        )