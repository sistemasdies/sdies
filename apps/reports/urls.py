from django.urls import path
from .views import (BalanceGeneralView, EstadoResultadosView,
                    BalanceComprobacionView, AuxiliaresView, ExportarReporteView)
urlpatterns = [
    path('balance-general/',     BalanceGeneralView.as_view(),     name='balance-general'),
    path('estado-resultados/',   EstadoResultadosView.as_view(),   name='estado-resultados'),
    path('balance-comprobacion/',BalanceComprobacionView.as_view(),name='balance-comprobacion'),
    path('auxiliares/',          AuxiliaresView.as_view(),         name='auxiliares'),
    path('exportar/',            ExportarReporteView.as_view(),    name='exportar-reporte'),
]
