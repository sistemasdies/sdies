from django.db import models

from apps.core.models.base import BaseModel


class Congregacion(BaseModel):
    """Congregación de la iglesia: código, nombre, dirección y pastor."""

    codigo    = models.CharField(max_length=4, unique=True)
    nombre    = models.CharField(max_length=12)
    direccion = models.CharField(max_length=40, blank=True)
    pastor    = models.ForeignKey(
        'accounting.Tercero', null=True, blank=True,
        on_delete=models.SET_NULL, to_field='cedula',
        related_name='congregaciones_pastor',
        verbose_name='Cédula del pastor',
    )

    class Meta:
        ordering            = ['codigo']
        verbose_name        = 'Congregación'
        verbose_name_plural = 'Congregaciones'

    def __str__(self):
        return f'{self.codigo} - {self.nombre}'
