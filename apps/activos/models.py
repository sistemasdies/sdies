from django.db import models


class Categoria(models.Model):
    categoria = models.CharField(max_length=3, primary_key=True)
    nombre_categoria = models.CharField(max_length=20)

    class Meta:
        db_table = 'activos_categoria'
        ordering = ['categoria']
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'

    def __str__(self):
        return f'{self.categoria} - {self.nombre_categoria}'


class Ubicacion(models.Model):
    ubicacion = models.CharField(max_length=4, primary_key=True)
    descripcion = models.CharField(max_length=20)

    class Meta:
        db_table = 'activos_ubicacion'
        ordering = ['ubicacion']
        verbose_name = 'Ubicación'
        verbose_name_plural = 'Ubicaciones'

    def __str__(self):
        return f'{self.ubicacion} - {self.descripcion}'


class EstadoActivoF(models.Model):
    estado_activo_f = models.CharField(max_length=1, primary_key=True)
    descripcion_estado_activo_f = models.CharField(max_length=15)

    class Meta:
        db_table = 'activos_estadoactivof'
        ordering = ['estado_activo_f']
        verbose_name = 'Estado de activo fijo'
        verbose_name_plural = 'Estados de activo fijo'

    def __str__(self):
        return f'{self.estado_activo_f} - {self.descripcion_estado_activo_f}'


class ActivoF(models.Model):
    id_activo_f = models.CharField(max_length=5, primary_key=True)
    nombre_activo_f = models.CharField(max_length=20)
    cantidad = models.PositiveIntegerField(default=1)
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, to_field='categoria',
                                 db_column='categoria', related_name='activos')
    marca = models.CharField(max_length=15, blank=True)
    modelo = models.CharField(max_length=10, blank=True)
    numero_serie = models.CharField(max_length=20, blank=True)
    congregacion = models.ForeignKey('congregacion.Congregacion', on_delete=models.PROTECT,
                                    to_field='codigo', db_column='congregacion', null=True, blank=True,
                                    related_name='activos_fijos')
    ubicacion = models.ForeignKey(Ubicacion, on_delete=models.PROTECT, to_field='ubicacion',
                                  db_column='ubicacion', related_name='activos')
    responsable = models.ForeignKey('accounting.Tercero', on_delete=models.PROTECT, to_field='cedula',
                                    db_column='responsable', related_name='activos_fijos', null=True, blank=True)
    estado_actual = models.ForeignKey(EstadoActivoF, on_delete=models.PROTECT, to_field='estado_activo_f',
                                      db_column='estado_actual', related_name='activos')
    fecha_adquisicion = models.DateField(null=True, blank=True)
    valor_compra = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    comentarios = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'activos_activof'
        ordering = ['id_activo_f']
        verbose_name = 'Activo fijo'
        verbose_name_plural = 'Activos fijos'

    def __str__(self):
        return f'{self.id_activo_f} - {self.nombre_activo_f}'


class FotoActivoF(models.Model):
    """Fotos de un activo fijo (cantidad variable)."""
    activo = models.ForeignKey(ActivoF, on_delete=models.CASCADE, related_name='fotos')
    url = models.URLField(max_length=500)
    public_id = models.CharField(max_length=255, blank=True)
    orden = models.PositiveIntegerField(default=0)
    descripcion = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activos_fotoactivof'
        ordering = ['orden', 'id']

    def __str__(self):
        return f'{self.activo_id} - foto {self.orden}'