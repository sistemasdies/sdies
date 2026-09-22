from django.db import models
from apps.core.models.base import BaseModel


class Comprobante(BaseModel):
    """Tipos de comprobante contable (CC, CE, CI, ND, NC...)."""
    codigo         = models.CharField(max_length=7, unique=True)
    descripcion    = models.CharField(max_length=100, blank=True)
    numero_inicial = models.IntegerField(null=True, blank=True)
    activo         = models.BooleanField(default=True)
    ultimo_numero  = models.IntegerField(default=0)

    class Meta:
        ordering            = ['codigo']
        verbose_name        = 'Comprobante'
        verbose_name_plural = 'Comprobantes'

    def __str__(self):
        return f"{self.codigo} - {self.descripcion}"

    def next_number(self) -> int:
        from django.db import transaction, connection
        with transaction.atomic():
            comp = Comprobante.objects.select_for_update().get(pk=self.pk)
            with connection.cursor() as c:
                c.execute(
                    "SELECT COALESCE(MAX(num_comprob), 0) "
                    "FROM accounting_movicont "
                    "WHERE cod_comprob_id = %s",
                    [comp.codigo]
                )
                max_real = c.fetchone()[0]
            comp.ultimo_numero = max_real
            comp.ultimo_numero += 1
            comp.save(update_fields=['ultimo_numero'])
            return comp.ultimo_numero