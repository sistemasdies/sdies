from django.db import models
from apps.core.models.base import BaseModel


class CentroCosto(BaseModel):
    codigo      = models.CharField(max_length=7, unique=True)
    descripcion = models.CharField(max_length=200)
    responsable = models.ForeignKey(
        'accounting.Tercero', null=True, blank=True,
        on_delete=models.SET_NULL, to_field='cedula',
        related_name='centros_responsable'
    )
    is_active   = models.BooleanField(default=True)

    class Meta:
        ordering            = ['codigo']
        verbose_name        = 'Centro de costo'
        verbose_name_plural = 'Centros de costo'

    def __str__(self):
        return f"{self.codigo} - {self.descripcion}"
