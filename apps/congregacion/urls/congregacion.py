from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.congregacion.views.congregacion_views import CongregacionViewSet

router = DefaultRouter()
router.register(r'', CongregacionViewSet, basename='congregacion')

urlpatterns = [path('', include(router.urls))]
