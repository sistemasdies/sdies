from django.db import models
from apps.core.models.base import BaseModel


class EstadoPeriodo(models.TextChoices):
    ABIERTO   = 'A', 'Abierto'
    EN_CIERRE = 'C', 'En cierre'
    CERRADO   = 'X', 'Cerrado'


class PeriodoContable(BaseModel):
    anio          = models.PositiveSmallIntegerField()
    mes           = models.PositiveSmallIntegerField()
    nombre        = models.CharField(max_length=30, blank=True)
    fecha_inicio  = models.DateField()
    fecha_fin     = models.DateField()
    estado        = models.CharField(max_length=1, choices=EstadoPeriodo.choices,
                                     default=EstadoPeriodo.ABIERTO)
    cerrado_por   = models.ForeignKey('users.User', null=True, blank=True,
                                      on_delete=models.SET_NULL,
                                      related_name='periodos_cerrados')
    fecha_cierre  = models.DateTimeField(null=True, blank=True)
    notas_cierre  = models.TextField(blank=True)

    class Meta:
        unique_together     = ('anio', 'mes')
        ordering            = ['anio', 'mes']
        verbose_name        = 'Período contable'
        verbose_name_plural = 'Períodos contables'

    def __str__(self):
        return self.nombre or f"{self.anio}-{self.mes:02d}"

    @property
    def esta_abierto(self):
        return self.estado == EstadoPeriodo.ABIERTO

    def save(self, *args, **kwargs):
        if not self.nombre:
            meses_es = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
            self.nombre = f"{meses_es[self.mes]} {self.anio}"
        super().save(*args, **kwargs)


class CierrePeriodoContable(BaseModel):
    """Snapshot inmutable del cierre de período."""
    periodo      = models.ForeignKey(PeriodoContable, on_delete=models.PROTECT,
                                     related_name='snapshots')
    cod_comprob  = models.CharField(max_length=7)
    num_comprob  = models.IntegerField()
    item_comprob = models.SmallIntegerField(null=True, blank=True)
    fecha        = models.DateField(null=True, blank=True)
    cuenta       = models.CharField(max_length=10)
    doc_ref      = models.CharField(max_length=8, blank=True)
    observacion  = models.CharField(max_length=100, blank=True)
    base         = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cedula       = models.CharField(max_length=12, blank=True)
    centro_costo = models.CharField(max_length=7, blank=True)
    vr_debitos   = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    vr_creditos  = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name        = 'Cierre de período'
        verbose_name_plural = 'Cierres de período'
        indexes = [models.Index(fields=['periodo', 'cuenta'])]
