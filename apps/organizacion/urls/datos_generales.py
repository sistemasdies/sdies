from django.urls import path

from apps.organizacion.views.datos_generales_views import DatosGeneralesView

urlpatterns = [
    path('', DatosGeneralesView.as_view(), name='datos-generales'),
]
