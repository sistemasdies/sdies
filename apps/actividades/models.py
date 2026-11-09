from django.db import models

from apps.core.models.base import BaseModel


class Acontecimiento(BaseModel):
    """Eventos especiales de una congregación: campamentos, paseos, salidas, etc."""

    item = models.PositiveIntegerField()
    congregacion = models.ForeignKey(
        'congregacion.Congregacion', on_delete=models.PROTECT,
        to_field='codigo', db_column='congregacion',
        related_name='acontecimientos',
    )
    fecha = models.DateField()
    titulo = models.CharField(max_length=30)
    comentarios = models.TextField(blank=True)

    class Meta:
        db_table = 'actividades_acontecimiento'
        ordering = ['-fecha', 'congregacion', 'item']
        verbose_name = 'Acontecimiento'
        verbose_name_plural = 'Acontecimientos'
        unique_together = ['congregacion', 'item']

    def __str__(self):
        return f'{self.congregacion_id} - {self.item} - {self.titulo}'


class FotoAcontecimiento(models.Model):
    """Fotos vinculadas a un acontecimiento."""

    acontecimiento = models.ForeignKey(
        Acontecimiento, on_delete=models.CASCADE,
        related_name='fotos',
    )
    url = models.URLField(max_length=500)
    public_id = models.CharField(max_length=255, blank=True)
    orden = models.PositiveIntegerField(default=0)
    descripcion = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'actividades_fotoacontecimiento'
        ordering = ['acontecimiento', 'orden']

    def __str__(self):
        return f'{self.acontecimiento} - foto {self.orden}'


class Asistencia(BaseModel):
    """Registro semanal/mensual de asistencia a una congregación."""

    fecha = models.DateField(db_index=True)
    congregacion = models.ForeignKey(
        'congregacion.Congregacion', on_delete=models.PROTECT,
        to_field='codigo', db_column='congregacion',
        related_name='asistencias',
    )
    creyentes = models.IntegerField(default=0)
    simpatizantes = models.IntegerField(default=0)
    visitas = models.IntegerField(default=0)
    ninos = models.IntegerField(default=0)
    online = models.IntegerField(default=0, verbose_name='OnLine')
    tema_predicacion = models.CharField(max_length=25, blank=True, verbose_name='Tema de predicación')
    comentarios = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'actividades_asistencia'
        ordering = ['-fecha', 'congregacion']
        verbose_name = 'Asistencia'
        verbose_name_plural = 'Asistencias'
        unique_together = ['fecha', 'congregacion']

    def __str__(self):
        return f'{self.fecha} — {self.congregacion_id}'
