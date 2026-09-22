from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/',             admin.site.urls),
    path('api/auth/',          include('apps.users.urls.auth')),
    path('api/users/',         include('apps.users.urls.users')),
    path('api/accounts/',      include('apps.accounting.urls.accounts')),
    path('api/comprobantes/',  include('apps.accounting.urls.comprobantes')),
    path('api/movicont/',      include('apps.accounting.urls.movicont')),
    path('api/periodos/',      include('apps.accounting.urls.periodos')),
    path('api/centros-costo/', include('apps.accounting.urls.centros_costo')),
    path('api/terceros/',      include('apps.accounting.urls.terceros')),
    path('api/plantillas/',    include('apps.accounting.urls.plantillas')),
    path('api/banking/',       include('apps.banking.urls')),
    path('api/reports/',       include('apps.reports.urls')),
    path('api/audit/',         include('apps.audit.urls')),
    path('api/schema/',        SpectacularAPIView.as_view(),                      name='schema'),
    path('api/docs/',          SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/',         SpectacularRedocView.as_view(url_name='schema'),   name='redoc'),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Fallback SPA: cualquier ruta que no sea API/admin/estatico devuelve index.html
if getattr(settings, 'SPA_BUILD_DIR', None) and (settings.SPA_BUILD_DIR / 'index.html').exists():
    from apps.core.views import spa_fallback
    urlpatterns += [
        re_path(r'^(?!api/|static/|media/|admin/|docs/|redoc/|schema/).*$',
                spa_fallback, name='spa'),
    ]

if settings.DEBUG:
    try:
        import debug_toolbar
        urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
    except ImportError:
        pass
