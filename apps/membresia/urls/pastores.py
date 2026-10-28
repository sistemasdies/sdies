from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.membresia.views.pastores_views import PastorViewSet

router = DefaultRouter()
router.register(r'', PastorViewSet, basename='pastor')

urlpatterns = [path('', include(router.urls))]