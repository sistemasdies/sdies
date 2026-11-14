from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from apps.core.utils.pagination import StandardPagination
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class   = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class   = StandardPagination

    def get_queryset(self):
        qs = AuditLog.objects.all()
        p  = self.request.query_params
        if p.get('resource'): qs = qs.filter(resource=p['resource'])
        if p.get('action'):   qs = qs.filter(action=p['action'])
        if p.get('user'):     qs = qs.filter(user__login=p['user'])
        if p.get('desde'):    qs = qs.filter(timestamp__date__gte=p['desde'])
        if p.get('hasta'):    qs = qs.filter(timestamp__date__lte=p['hasta'])
        return qs

    @action(detail=False, methods=['get'])
    def resources(self, request):
        """Lista los recursos distintos registrados en auditoría."""
        qs = AuditLog.objects.order_by().values_list('resource', flat=True).distinct()
        return Response(sorted(qs))

    @action(detail=False, methods=['get'])
    def users(self, request):
        """Lista los usuarios distintos que tienen logs de auditoría."""
        qs = AuditLog.objects.filter(user__isnull=False).order_by(
            'user__login'
        ).values('user__login', 'user__NameUser').distinct()
        return Response([
            {'login': r['user__login'], 'nombre': r['user__NameUser']}
            for r in qs
        ])
