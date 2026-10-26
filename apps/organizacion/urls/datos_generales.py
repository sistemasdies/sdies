from django.urls import path

from apps.organizacion.views.datos_generales_views import (
    DatosGeneralesView, CloudinaryImagenesView,
)

urlpatterns = [
    path('imagenes-cloudinary/', CloudinaryImagenesView.as_view(),
         name='datos-generales-imagenes-cloudinary'),
    path('', DatosGeneralesView.as_view(), name='datos-generales'),
]
