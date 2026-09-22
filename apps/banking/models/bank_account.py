from django.db import models
from apps.core.models.base import BaseModel

class CuentaBancaria(BaseModel):
    nombre          = models.CharField(max_length=200)
    banco           = models.CharField(max_length=100)
    numero_cuenta   = models.CharField(max_length=50, unique=True)
    tipo            = models.CharField(max_length=30, blank=True)
    moneda          = models.CharField(max_length=3, default='COP')
    cuenta_contable = models.ForeignKey('accounting.Cuenta', on_delete=models.PROTECT,
                                        to_field='codigo', related_name='cuentas_bancarias',
                                        null=True, blank=True)
    saldo_inicial   = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    fecha_apertura  = models.DateField(null=True, blank=True)
    is_active       = models.BooleanField(default=True)
    swift           = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ['nombre']
    def __str__(self):
        return f"{self.banco} - ***{self.numero_cuenta[-4:]} ({self.nombre})"

class TransaccionBancaria(BaseModel):
    class TipoTx(models.TextChoices):
        DEBITO  = 'D', 'Débito'
        CREDITO = 'C', 'Crédito'
    class EstadoTx(models.TextChoices):
        PENDIENTE  = 'P', 'Pendiente'
        CONCILIADO = 'C', 'Conciliado'

    cuenta_bancaria = models.ForeignKey(CuentaBancaria, on_delete=models.CASCADE,
                                        related_name='transacciones')
    fecha           = models.DateField(db_index=True)
    descripcion     = models.CharField(max_length=300)
    referencia      = models.CharField(max_length=100, blank=True)
    tipo            = models.CharField(max_length=1, choices=TipoTx.choices)
    monto           = models.DecimalField(max_digits=18, decimal_places=2)
    saldo           = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    estado          = models.CharField(max_length=1, choices=EstadoTx.choices,
                                       default=EstadoTx.PENDIENTE)
    asiento         = models.ForeignKey('accounting.MoviCont', null=True, blank=True,
                                        on_delete=models.SET_NULL,
                                        related_name='transacciones_bancarias')
    origen          = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ['-fecha','-created_at']

class ConciliacionBancaria(BaseModel):
    class EstadoCon(models.TextChoices):
        ABIERTA = 'A', 'Abierta'
        CERRADA = 'C', 'Cerrada'

    cuenta_bancaria = models.ForeignKey(CuentaBancaria, on_delete=models.CASCADE,
                                        related_name='conciliaciones')
    periodo         = models.ForeignKey('accounting.PeriodoContable', on_delete=models.PROTECT)
    fecha_extracto  = models.DateField()
    saldo_extracto  = models.DecimalField(max_digits=18, decimal_places=2)
    saldo_libros    = models.DecimalField(max_digits=18, decimal_places=2)
    diferencia      = models.DecimalField(max_digits=18, decimal_places=2)
    estado          = models.CharField(max_length=1, choices=EstadoCon.choices,
                                       default=EstadoCon.ABIERTA)
    notas           = models.TextField(blank=True)
    cerrada_por     = models.ForeignKey('users.User', null=True, blank=True,
                                        on_delete=models.SET_NULL)
    fecha_cierre    = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('cuenta_bancaria','periodo')
