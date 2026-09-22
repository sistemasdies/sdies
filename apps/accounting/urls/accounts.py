from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounting.views.cuentas_views import CuentaViewSet
router = DefaultRouter()
router.register(r'', CuentaViewSet, basename='cuenta')
urlpatterns = [path('', include(router.urls))]
