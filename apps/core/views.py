from django.conf import settings
from django.http import FileResponse, Http404


def spa_fallback(request, path=''):
    index = getattr(settings, 'SPA_BUILD_DIR', None)
    if not index or not (index / 'index.html').exists():
        raise Http404
    return FileResponse((index / 'index.html').open('rb'), content_type='text/html')