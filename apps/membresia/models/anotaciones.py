from django.db import models

from apps.core.models.base import BaseModel


class AnotacionPastor(BaseModel):
    """Anotaciones del pastor para una membresía (por cédula de Tercero)."""
    cedula = models.ForeignKey(
        'accounting.Tercero', on_delete=models.PROTECT, to_field='cedula',
        related_name='anotaciones_pastor', verbose_name='Cédula',
    )
    fecha = models.DateField(verbose_name='Fecha')
    anotacion = models.TextField(verbose_name='Anotación')
    cedula_firma = models.ForeignKey(
        'accounting.Tercero', on_delete=models.PROTECT, to_field='cedula',
        related_name='anotaciones_pastor_firma', verbose_name='Cédula firma',
    )

    class Meta:
        ordering = ['-fecha', '-created_at']
        verbose_name = 'Anotación del pastor'
        verbose_name_plural = 'Anotaciones del pastor'

    def __str__(self):
        return f'{self.cedula_id} - {self.fecha}'


class AnotacionMisionero(BaseModel):
    """Anotaciones del misionero para una membresía (por cédula de Tercero)."""
    cedula = models.ForeignKey(
        'accounting.Tercero', on_delete=models.PROTECT, to_field='cedula',
        related_name='anotaciones_misionero', verbose_name='Cédula',
    )
    fecha = models.DateField(verbose_name='Fecha')
    anotacion = models.TextField(verbose_name='Anotación')
    cedula_firma = models.ForeignKey(
        'accounting.Tercero', on_delete=models.PROTECT, to_field='cedula',
        related_name='anotaciones_misionero_firma', verbose_name='Cédula firma',
    )

    class Meta:
        ordering = ['-fecha', '-created_at']
        verbose_name = 'Anotación del misionero'
        verbose_name_plural = 'Anotaciones del misionero'

    def __str__(self):
        return f'{self.cedula_id} - {self.fecha}'