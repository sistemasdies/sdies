from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounting.views.centros_costo_views import CentroCostoViewSet
router = DefaultRouter()
router.register(r'', CentroCostoViewSet, basename='centrocosto')
urlpatterns = [path('', include(router.urls))]
