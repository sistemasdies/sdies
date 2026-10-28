from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.membresia.views.estados_pastor_views import EstadoPastorViewSet

router = DefaultRouter()
router.register(r'', EstadoPastorViewSet, basename='estado-pastor')

urlpatterns = [path('', include(router.urls))]