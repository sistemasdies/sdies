from django.db import models

from apps.core.models.base import BaseModel


class Pastor(BaseModel):
    """Pastor (postulante/ordenado) vinculado a una membresía por cédula."""

    codigo_pastor = models.ForeignKey(
        'accounting.Tercero', on_delete=models.PROTECT, to_field='cedula',
        db_column='codigo_pastor', related_name='pastores',
        verbose_name='Código pastor (cédula)',
    )
    estado_pastor = models.ForeignKey(
        'EstadoPastor', to_field='estado', db_column='estado_pastor',
        on_delete=models.PROTECT, default='1',
        verbose_name='Estado pastor',
    )
    tipo_licencia = models.CharField(
        max_length=1,
        choices=[
            ('1', 'Miembro en Proceso de Formación Ministerial Fase 1'),
            ('2', 'Miembro en Proceso de Formación Ministerial Fase 2'),
            ('3', 'Ministro de culto fase 1 (Licencia General)'),
            ('4', 'Ministro de culto fase 2 (Licencia Ordenación)'),
            ('5', 'Misionero (Licencia Ordenación)'),
        ],
        default='1',
        verbose_name='Tipo de licencia',
    )
    nombre_pastor_postulante = models.CharField(max_length=30, blank=True)
    fecha_licencia_fase1 = models.DateField(null=True, blank=True)
    lugar_aprobado_fase1 = models.CharField(max_length=30, blank=True)
    aprobado_fase1_por = models.CharField(max_length=30, blank=True)
    fecha_licencia_fase2 = models.DateField(null=True, blank=True)
    lugar_aprobado_fase2 = models.CharField(max_length=30, blank=True)
    aprobado_fase2_por = models.CharField(max_length=30, blank=True)
    fecha_licencia_general = models.DateField(null=True, blank=True)
    lugar_aprobado_general = models.CharField(max_length=30, blank=True)
    aprobado_general_por = models.CharField(max_length=30, blank=True)
    fecha_licencia_ordenacion = models.DateField(null=True, blank=True)
    lugar_aprobado_ordenacion = models.CharField(max_length=30, blank=True)
    aprobado_ordenacion_por = models.CharField(max_length=30, blank=True)
    comentarios = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['codigo_pastor']
        verbose_name = 'Pastor'
        verbose_name_plural = 'Pastores'

    def __str__(self):
        return f'{self.codigo_pastor_id} - {self.nombre_pastor_postulante}'