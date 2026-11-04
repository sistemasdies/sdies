from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.membresia.views.areas_trabajo_views import AreaTrabajoViewSet

router = DefaultRouter()
router.register(r'', AreaTrabajoViewSet, basename='area-trabajo')

urlpatterns = [path('', include(router.urls))]
