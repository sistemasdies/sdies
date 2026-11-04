from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.membresia.views.cargos_views import CargoViewSet

router = DefaultRouter()
router.register(r'', CargoViewSet, basename='cargo')

urlpatterns = [path('', include(router.urls))]
