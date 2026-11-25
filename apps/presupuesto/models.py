from django.db import models
from apps.core.models.base import BaseModel


class Presupuesto(BaseModel):
    """Presupuesto anual mensual por cuenta y centro de costo.

    Se guarda un único monto mensual por combinación cuenta/centro_de_costo/año.
    El control presupuestal multiplica este valor por la cantidad de meses
    necesarios (1 para mensual, N para acumulado).
    """

    anio = models.PositiveSmallIntegerField(verbose_name='Año')
    cuenta = models.ForeignKey(
        'accounting.Cuenta',
        on_delete=models.PROTECT,
        to_field='codigo',
        related_name='presupuestos',
        verbose_name='Cuenta',
    )
    centro_costo = models.ForeignKey(
        'accounting.CentroCosto',
        on_delete=models.PROTECT,
        to_field='codigo',
        related_name='presupuestos',
        verbose_name='Centro de costo',
    )
    monto_mensual = models.DecimalField(
        max_digits=14, decimal_places=2,
        verbose_name='Monto mensual',
    )

    class Meta:
        verbose_name = 'Presupuesto'
        verbose_name_plural = 'Presupuestos'
        ordering = ['anio', 'cuenta__codigo', 'centro_costo__codigo']
        unique_together = ['anio', 'cuenta', 'centro_costo']
        permissions = [
            ('acceder', 'Puede acceder al módulo presupuesto'),
            ('listar', 'Puede listar presupuestos'),
            ('agregar', 'Puede agregar presupuestos'),
            ('editar', 'Puede editar presupuestos'),
            ('borrar', 'Puede borrar presupuestos'),
        ]

    def __str__(self):
        return f'{self.anio} | {self.cuenta} | {self.centro_costo} | {self.monto_mensual}'
