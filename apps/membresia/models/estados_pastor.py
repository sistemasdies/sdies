from django.db import models


class EstadoPastor(models.Model):
    """Catálogo de estados de un pastor (tabla EstadosPastor)."""
    estado = models.CharField(max_length=1, primary_key=True)
    descripcion = models.CharField(max_length=15)

    class Meta:
        db_table = 'membresia_estadospastor'
        ordering = ['estado']
        verbose_name = 'Estado de pastor'
        verbose_name_plural = 'Estados de pastor'

    def __str__(self):
        return f'{self.estado} - {self.descripcion}'