from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounting.views.comprobantes_views import ComprobanteViewSet
router = DefaultRouter()
router.register(r'', ComprobanteViewSet, basename='comprobante')
urlpatterns = [path('', include(router.urls))]
