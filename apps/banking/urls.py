from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.banking.views.views import (
    CuentaBancariaViewSet, TransaccionBancariaViewSet, ConciliacionBancariaViewSet
)
router = DefaultRouter()
router.register(r'cuentas',        CuentaBancariaViewSet,     basename='cuenta-bancaria')
router.register(r'transacciones',  TransaccionBancariaViewSet,basename='transaccion')
router.register(r'conciliaciones', ConciliacionBancariaViewSet,basename='conciliacion')
urlpatterns = [path('', include(router.urls))]
