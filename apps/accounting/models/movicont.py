from django.db import models
from django.core.exceptions import ValidationError
from apps.core.models.base import BaseModel


class MoviCont(BaseModel):
    """Movimiento contable unificado (cabecera + línea en una sola tabla).

    Clave única: (cod_comprob, num_comprob, item_comprob).
    """
    cod_comprob  = models.ForeignKey('accounting.Comprobante',
                                     on_delete=models.PROTECT,
                                     to_field='codigo',
                                     related_name='movimientos')
    num_comprob  = models.IntegerField()
    item_comprob = models.SmallIntegerField()
    fecha        = models.DateField(db_index=True)
    cuenta       = models.ForeignKey('accounting.Cuenta',
                                     on_delete=models.PROTECT,
                                     to_field='codigo',
                                     related_name='movimientos')
    doc_ref      = models.CharField(max_length=14, blank=True)
    observacion  = models.CharField(max_length=200, blank=True)
    cedula       = models.ForeignKey('accounting.Tercero',
                                     null=True, blank=True,
                                     on_delete=models.PROTECT,
                                     to_field='cedula',
                                     related_name='movimientos')
    centro_costo = models.ForeignKey('accounting.CentroCosto',
                                     null=True, blank=True,
                                     on_delete=models.PROTECT,
                                     to_field='codigo',
                                     related_name='movimientos')
    doc_soporte  = models.CharField(max_length=15, blank=True)
    vr_debitos   = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vr_creditos  = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        unique_together     = ('cod_comprob', 'num_comprob', 'item_comprob')
        ordering            = ['fecha', 'num_comprob', 'item_comprob']
        verbose_name        = 'Movimiento contable'
        verbose_name_plural = 'Movimientos contables'
        indexes = [
            models.Index(fields=['fecha']),
            models.Index(fields=['num_comprob']),
        ]

    def __str__(self):
        return f"{self.cod_comprob_id}-{self.num_comprob:06d} item {self.item_comprob}"

    def clean(self):
        if self.vr_debitos < 0 or self.vr_creditos < 0:
            raise ValidationError("Los valores no pueden ser negativos.")
        if self.vr_debitos > 0 and self.vr_creditos > 0:
            raise ValidationError("Una línea no puede tener débito y crédito simultáneamente.")
        if self.vr_debitos == 0 and self.vr_creditos == 0:
            raise ValidationError("La línea debe tener débito o crédito.")
