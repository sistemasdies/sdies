from django.db import models
from apps.core.models.base import BaseModel


class PlantillaContable(BaseModel):
    cod_plantilla = models.CharField(max_length=7, unique=True)
    nombre        = models.CharField(max_length=60)
    descripcion   = models.CharField(max_length=200, blank=True)
    comprobante   = models.ForeignKey('accounting.Comprobante', null=True, blank=True,
                                      on_delete=models.SET_NULL, to_field='codigo',
                                      related_name='plantillas')

    class Meta:
        ordering = ['cod_plantilla']

    def __str__(self):
        return f"{self.cod_plantilla} - {self.nombre}"


class DetallePlantilla(BaseModel):
    plantilla    = models.ForeignKey(PlantillaContable, on_delete=models.CASCADE,
                                     related_name='detalles')
    item         = models.SmallIntegerField()
    cuenta       = models.CharField(max_length=10, blank=True)
    doc_ref      = models.CharField(max_length=8, blank=True)
    observacion  = models.CharField(max_length=200, blank=True)
    tipo_mov     = models.CharField(max_length=1, blank=True)
    valor        = models.CharField(max_length=32, blank=True)
    base         = models.CharField(max_length=32, blank=True)
    cedula       = models.CharField(max_length=12, blank=True)
    centro_costo = models.CharField(max_length=7, blank=True)
    comentarios  = models.CharField(max_length=200, blank=True)
    doc_soporte  = models.CharField(max_length=15, blank=True)

    class Meta:
        unique_together = ('plantilla', 'item')
        ordering        = ['item']
