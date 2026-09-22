from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated, IsAdminUser
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
