from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.membresia.views.membresia_views import MembresiaViewSet
router = DefaultRouter()
router.register(r'', MembresiaViewSet, basename='membresia')
urlpatterns = [path('', include(router.urls))]
