from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.accounting.models import CentroCosto
from apps.accounting.serializers.centros_costo import CentroCostoSerializer
from apps.users.services.scopes import user_scope


class CentroCostoViewSet(viewsets.ModelViewSet):
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
    def perform_destroy(self, instance):
        instance.delete()