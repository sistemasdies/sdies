from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounting.views.periodos_views import PeriodoContableViewSet
router = DefaultRouter()
router.register(r'', PeriodoContableViewSet, basename='periodo')
urlpatterns = [path('', include(router.urls))]
