from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.membresia.views.anotaciones_views import AnotacionPastorViewSet

router = DefaultRouter()
router.register(r'', AnotacionPastorViewSet, basename='anotacion-pastor')

urlpatterns = [path('', include(router.urls))]