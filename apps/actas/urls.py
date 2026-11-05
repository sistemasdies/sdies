from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.actas.views import ActaReunionViewSet, FirmaPublicaViewSet

router = DefaultRouter()
router.register(r'actas', ActaReunionViewSet, basename='acta')

urlpatterns = [
    path('', include(router.urls)),
    path('firmar/<str:pk>/', FirmaPublicaViewSet.as_view({
        'get': 'retrieve',
        'post': 'create',
    }), name='firma-publica'),
]
