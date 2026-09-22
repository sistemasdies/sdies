from django.db import models
from apps.core.models.base import BaseModel


def calcular_padre_codigo(codigo: str) -> str:
    """
    Padre según longitud del código:
    1 dígito  → sin padre (raíz)
    2 dígitos → padre = primer dígito
    4 dígitos → padre = primeros 2 dígitos
    6 dígitos → padre = primeros 4 dígitos
    """
    n = len(codigo.strip())
    if n == 1: return ''
    if n == 2: return codigo[:1]
    if n == 4: return codigo[:2]
    if n == 6: return codigo[:4]
    return ''


def calcular_clase(codigo: str) -> str:
    mapa = {'1':'A', '2':'P', '3':'T', '4':'I', '5':'G'}
    return mapa.get(codigo[:1], '') if codigo else ''


class Cuenta(BaseModel):
    codigo      = models.CharField(max_length=12, unique=True)
    descripcion = models.CharField(max_length=200)
    nivel       = models.CharField(max_length=1, blank=True)
    naturaleza  = models.CharField(max_length=1, blank=True)
    tipo_pgmd   = models.CharField(max_length=1, blank=True)
    clase_aptig = models.CharField(max_length=1, blank=True, db_column='clase_apt')
    captura_np  = models.CharField(max_length=1, blank=True)
    conversion  = models.CharField(max_length=5,  blank=True)
    base_ret    = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    porc_ret    = models.DecimalField(max_digits=6,  decimal_places=4, null=True, blank=True)
    padre       = models.ForeignKey('self', null=True, blank=True,
                                    on_delete=models.PROTECT, related_name='hijos')
    es_detalle  = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=True)
    permite_cc  = models.BooleanField(default=False)

    class Meta:
        ordering = ['codigo']
        verbose_name = 'Cuenta contable'
        verbose_name_plural = 'Cuentas contables'

    def __str__(self):
        return f"{self.codigo} - {self.descripcion}"

    def save(self, *args, **kwargs):
        # Clase siempre inferida del primer dígito
        self.clase_aptig = calcular_clase(self.codigo)
        # Padre calculado del código — sin buscarlo en request
        cod_padre = calcular_padre_codigo(self.codigo)
        if cod_padre:
            self.padre = Cuenta.objects.filter(
                codigo=cod_padre, deleted=False
            ).first()  # None si todavía no existe
        else:
            self.padre = None
        super().save(*args, **kwargs)

    @property
    def clase_aptig_display(self):
        return {'A':'Activo','P':'Pasivo','T':'Patrimonio',
                'I':'Ingreso','G':'Gasto'}.get(self.clase_aptig, '')