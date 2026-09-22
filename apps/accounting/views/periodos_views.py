from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.core.exceptions import ValidationError
from apps.accounting.models import PeriodoContable
from apps.accounting.serializers.periodos import PeriodoContableSerializer
from apps.accounting.services.cierre_service import CierreService


class PeriodoContableViewSet(viewsets.ModelViewSet):
    pagination_class   = None
    serializer_class   = PeriodoContableSerializer
    module             = 'periodos'
    permission_classes = [IsAuthenticated]
    queryset           = PeriodoContable.objects.filter(deleted=False).order_by('anio','mes')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def cerrar(self, request, pk=None):
        if not (request.user.is_superuser or request.user.is_staff):
            return Response({'detail': 'Solo administradores pueden cerrar períodos.'}, status=403)
        periodo = self.get_object()
        try:
            periodo = CierreService.cerrar_periodo(
                periodo, request.user, notas=request.data.get('notas','')
            )
        except ValidationError as e:
            raise DRFValidationError({'detail': e.messages})
        return Response(PeriodoContableSerializer(periodo).data)