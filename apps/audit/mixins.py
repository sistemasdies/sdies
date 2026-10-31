from django.forms.models import model_to_dict

from apps.audit.models import AuditLog


class AuditMixin:
    """Mixin para registrar automáticamente create/update/delete en AuditLog."""

    audit_resource = None

    def _client_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def _snapshot(self, instance):
        if instance is None:
            return None
        try:
            data = model_to_dict(instance)
            # Convertir UUIDs/dates a str para JSON
            for k, v in list(data.items()):
                if hasattr(v, 'pk'):
                    data[k] = str(v.pk)
                elif not isinstance(v, (str, int, float, bool, list, dict, type(None))):
                    data[k] = str(v)
            return data
        except Exception:
            return None

    def _log(self, action, instance, before=None, after=None):
        try:
            request = getattr(self, 'request', None)
            user = getattr(request, 'user', None) if request else None
            if user is not None and not getattr(user, 'is_authenticated', False):
                user = None
            AuditLog.objects.create(
                user=user,
                action=action,
                resource=self.audit_resource or (instance._meta.model_name if instance else ''),
                resource_id=str(getattr(instance, 'pk', '')),
                before_data=before,
                after_data=after,
                ip_address=self._client_ip(request) if request else None,
                user_agent=(request.META.get('HTTP_USER_AGENT', '')[:500] if request else ''),
                endpoint=(request.path if request else ''),
                http_method=(request.method if request else ''),
            )
        except Exception:
            pass

    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._log('create', serializer.instance, before=None, after=self._snapshot(serializer.instance))

    def perform_update(self, serializer):
        instance = self.get_object()
        before = self._snapshot(instance)
        super().perform_update(serializer)
        self._log('update', serializer.instance, before=before, after=self._snapshot(serializer.instance))

    def perform_destroy(self, instance):
        before = self._snapshot(instance)
        super().perform_destroy(instance)
        self._log('delete', instance, before=before, after=None)