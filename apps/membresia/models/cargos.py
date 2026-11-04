from django.db import models


class Cargo(models.Model):
    """Catálogo de cargos para equipos de trabajo."""
    codigo_cargo = models.CharField('Código', max_length=2, primary_key=True)
    nombre_cargo = models.CharField('Nombre', max_length=20)

    class Meta:
        db_table = 'membresia_cargo'
        ordering = ['codigo_cargo']
        verbose_name = 'Cargo'
        verbose_name_plural = 'Cargos'

    def __str__(self):
        return f'{self.codigo_cargo} - {self.nombre_cargo}'
