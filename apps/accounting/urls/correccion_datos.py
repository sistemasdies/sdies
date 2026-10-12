from django.urls import path
from apps.accounting.views.correccion_datos_views import PreviewView, AplicarView

urlpatterns = [
    path('preview/', PreviewView.as_view(), name='correccion-datos-preview'),
    path('aplicar/', AplicarView.as_view(), name='correccion-datos-aplicar'),
]
