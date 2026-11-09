from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import F

from apps.actividades.models import Asistencia
from apps.actividades.serializers import AsistenciaSerializer
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.audit.mixins import AuditMixin
from apps.users.services.scopes import user_scope


class AsistenciaViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    serializer_class = AsistenciaSerializer
    module = 'actividades'
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
