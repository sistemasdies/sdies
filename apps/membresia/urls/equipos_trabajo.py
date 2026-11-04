from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.membresia.views.equipos_trabajo_views import EquipoTrabajoViewSet

router = DefaultRouter()
router.register(r'', EquipoTrabajoViewSet, basename='equipo-trabajo')

urlpatterns = [path('', include(router.urls))]
