import threading
import logging

_local = threading.local()
logger = logging.getLogger('apps.audit')


def get_current_user():
    return getattr(_local, 'user', None)


class CurrentUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _local.user = request.user if hasattr(request, 'user') and request.user.is_authenticated else None
        return self.get_response(request)


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)
