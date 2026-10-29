from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.activos.views import (
    CategoriaViewSet, UbicacionViewSet, EstadoActivoFViewSet, ActivoFViewSet,
    FotoActivoFViewSet,
)

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet, basename='categoria')
router.register(r'ubicaciones', UbicacionViewSet, basename='ubicacion')
router.register(r'estados-activos', EstadoActivoFViewSet, basename='estado-activo-f')
router.register(r'activos', ActivoFViewSet, basename='activo-f')
router.register(r'fotos-activos', FotoActivoFViewSet, basename='foto-activo-f')

urlpatterns = [path('', include(router.urls))]