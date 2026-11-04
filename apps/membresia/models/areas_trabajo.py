from django.db import models


class AreaTrabajo(models.Model):
    """Áreas de trabajo de la iglesia."""
    codigo_area = models.CharField('Código', max_length=7, primary_key=True)
    nombre_area = models.CharField('Nombre', max_length=20)
    descripcion_area = models.CharField('Descripción', max_length=100, blank=True)
    comentarios_area = models.TextField('Comentarios', blank=True)

    class Meta:
        db_table = 'membresia_areatrabajo'
        ordering = ['codigo_area']
        verbose_name = 'Área de trabajo'
        verbose_name_plural = 'Áreas de trabajo'

    def __str__(self):
        return f'{self.codigo_area} - {self.nombre_area}'
