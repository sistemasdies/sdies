from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.membresia.views.anotaciones_views import AnotacionMisioneroViewSet

router = DefaultRouter()
router.register(r'', AnotacionMisioneroViewSet, basename='anotacion-misionero')

urlpatterns = [path('', include(router.urls))]