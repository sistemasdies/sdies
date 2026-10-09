from django.urls import path
from .views import (BalanceGeneralView, EstadoResultadosView,
                    BalanceComprobacionView, AuxiliaresView,
                    ComparativoMesesView, ExportarReporteView,
                    BackupExportView, BackupImportView)
urlpatterns = [
    path('balance-general/',     BalanceGeneralView.as_view(),     name='balance-general'),
    path('estado-resultados/',   EstadoResultadosView.as_view(),   name='estado-resultados'),
    path('balance-comprobacion/',BalanceComprobacionView.as_view(),name='balance-comprobacion'),
    path('auxiliares/',          AuxiliaresView.as_view(),         name='auxiliares'),
    path('comparativo-meses/',   ComparativoMesesView.as_view(),   name='comparativo-meses'),
    path('exportar/',            ExportarReporteView.as_view(),    name='exportar-reporte'),
    path('backup-export/',       BackupExportView.as_view(),       name='backup-export'),
    path('backup-import/',       BackupImportView.as_view(),       name='backup-import'),
]
