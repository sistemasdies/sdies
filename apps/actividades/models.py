from django.db import models

from apps.core.models.base import BaseModel


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
