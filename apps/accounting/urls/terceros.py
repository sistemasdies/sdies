from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounting.views.terceros_views import TerceroViewSet
router = DefaultRouter()
router.register(r'', TerceroViewSet, basename='tercero')
urlpatterns = [path('', include(router.urls))]
