from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.actividades.views import AcontecimientoViewSet, AsistenciaViewSet, VisitacionViewSet

router = DefaultRouter()
router.register(r'acontecimientos', AcontecimientoViewSet, basename='acontecimiento')
router.register(r'asistencias', AsistenciaViewSet, basename='asistencia')
router.register(r'visitaciones', VisitacionViewSet, basename='visitacion')

urlpatterns = [path('', include(router.urls))]
