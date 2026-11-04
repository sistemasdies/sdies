from django.db import models

from apps.core.models.base import BaseModel


class EquipoTrabajo(BaseModel):
    """Integrantes de equipos de trabajo por área y cargo."""
    area_trabajo = models.ForeignKey(
        'membresia.AreaTrabajo', on_delete=models.PROTECT,
        to_field='codigo_area', db_column='codigo_area',
        related_name='equipos', verbose_name='Área de trabajo',
    )
    cargo = models.ForeignKey(
        'membresia.Cargo', on_delete=models.PROTECT,
        to_field='codigo_cargo', db_column='codigo_cargo',
        related_name='equipos', verbose_name='Cargo',
    )
    congregacion = models.ForeignKey(
        'congregacion.Congregacion', on_delete=models.PROTECT,
        to_field='codigo', db_column='congregacion_codigo',
        related_name='equipos_trabajo', verbose_name='Congregación',
        null=True, blank=True,
    )
    responsable = models.ForeignKey(
        'membresia.Membresia', on_delete=models.PROTECT,
        to_field='tercero_id', db_column='responsable_cedula',
        related_name='equipos_trabajo', verbose_name='Responsable',
    )
    vigencia_desde = models.DateField('Vigencia desde', blank=True, null=True)
    vigencia_hasta = models.DateField('Vigencia hasta', blank=True, null=True)
    comentarios = models.TextField('Comentarios', blank=True)

    class Meta:
        db_table = 'membresia_equipotrabajo'
        ordering = ['area_trabajo__codigo_area', 'cargo__codigo_cargo']
        verbose_name = 'Equipo de trabajo'
        verbose_name_plural = 'Equipos de trabajo'

    def __str__(self):
        return f'{self.area_trabajo_id} / {self.cargo_id} / {self.responsable_id}'
