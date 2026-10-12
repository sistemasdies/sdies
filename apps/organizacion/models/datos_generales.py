import uuid

from django.db import models

from apps.core.models.base import BaseModel

# PK fija: garantiza que exista una sola fila (registro único / singleton).
SINGLETON_ID = uuid.UUID('11111111-1111-1111-1111-111111111111')


class DatosGenerales(BaseModel):
    """Datos generales de la organización (registro único).

    Nombre, NIT, contacto, presidente (tercero) y logos/imágenes de la app.
    Solo existe una fila; se accede siempre con `DatosGenerales.get_solo()`.
    """

    id = models.UUIDField(primary_key=True, default=SINGLETON_ID, editable=False)

    NombreOrganizacion   = models.CharField(max_length=200, blank=True,
                                            verbose_name='Nombre de la organización')
    NIT                  = models.CharField(max_length=30, blank=True,
                                            verbose_name='NIT')
    direccion            = models.CharField(max_length=200, blank=True,
                                            verbose_name='Dirección')
    telefono             = models.CharField(max_length=30, blank=True,
                                            verbose_name='Teléfono')
    email                = models.EmailField(max_length=100, blank=True,
                                             verbose_name='Email')
    CedulaPresidente     = models.ForeignKey(
        'accounting.Tercero', null=True, blank=True, on_delete=models.SET_NULL,
        to_field='cedula', db_column='cedula_presidente', related_name='+',
        verbose_name='Presidente (tercero)')
    ciudad               = models.CharField(max_length=80, blank=True,
                                            verbose_name='Ciudad')
    pais                 = models.CharField(max_length=80, blank=True,
                                            verbose_name='País')
    LogoDeLaOrganizacion = models.ImageField(upload_to='datos_generales/',
                                             null=True, blank=True,
                                             verbose_name='Logo de la organización')
    logoDeLaApp          = models.ImageField(upload_to='datos_generales/',
                                             null=True, blank=True,
                                             verbose_name='Logo de la app')
    FondoDeLaApp         = models.ImageField(upload_to='datos_generales/',
                                             null=True, blank=True,
                                             verbose_name='Fondo de la app')

    class Meta:
        verbose_name        = 'Datos generales'
        verbose_name_plural = 'Datos generales'
        ordering            = ['created_at']

    def __str__(self):
        return self.NombreOrganizacion or 'Datos generales'

    @classmethod
    def get_solo(cls):
        """Devuelve (creando si hace falta) el único registro de datos generales."""
        obj, _ = cls.all_objects.get_or_create(pk=SINGLETON_ID)
        return obj
