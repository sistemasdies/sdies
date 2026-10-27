from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.membresia.views.estados_views import EstadoMembresiaViewSet

router = DefaultRouter()
router.register(r'', EstadoMembresiaViewSet, basename='estado-membresia')

urlpatterns = [path('', include(router.urls))]