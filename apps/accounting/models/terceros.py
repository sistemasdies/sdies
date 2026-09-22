from django.db import models
from apps.core.models.base import BaseModel


class TipoPersona(models.TextChoices):
    NATURAL  = 'N', 'Natural'
    JURIDICA = 'J', 'Jurídica'

class Tercero(BaseModel):
    """Personas naturales y jurídicas: clientes, proveedores, empleados."""
    cedula         = models.CharField(max_length=12, unique=True)
    tipo_documento = models.CharField(max_length=2, blank=True)
    tipo_persona   = models.CharField(max_length=1, choices=TipoPersona.choices, blank=True)
    nombre1        = models.CharField(max_length=50, blank=True)
    nombre2        = models.CharField(max_length=50, blank=True)
    apellido1      = models.CharField(max_length=50, blank=True)
    apellido2      = models.CharField(max_length=50, blank=True)
    razon_social   = models.CharField(max_length=200, blank=True)
    direccion      = models.CharField(max_length=200, blank=True)
    barrio         = models.CharField(max_length=50, blank=True)
    municipio      = models.CharField(max_length=3, blank=True)
    departamento   = models.CharField(max_length=2, blank=True)
    distrito       = models.CharField(max_length=2, blank=True)
    telefono1      = models.CharField(max_length=30, blank=True)
    telefono2      = models.CharField(max_length=20, blank=True)
    celular        = models.CharField(max_length=20, blank=True)
    fax            = models.CharField(max_length=20, blank=True)
    email          = models.EmailField(max_length=80, blank=True)
    lugar_exp_cedula = models.CharField(max_length=60, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    lugar_nacimiento = models.CharField(max_length=100, blank=True)
    sexo           = models.CharField(max_length=1, blank=True)
    tipo_sangre    = models.CharField(max_length=3, blank=True)
    parametros     = models.CharField(max_length=30, blank=True)
    comentarios    = models.TextField(blank=True)
    is_active      = models.BooleanField(default=True)

    class Meta:
        ordering            = ['apellido1', 'nombre1', 'razon_social']
        verbose_name        = 'Tercero'
        verbose_name_plural = 'Terceros'

    def __str__(self):
        if self.razon_social:
            return f"{self.cedula} - {self.razon_social}"
        return f"{self.cedula} - {self.apellido1} {self.nombre1}"

    @property
    def nombre_completo(self):
        if self.razon_social:
            return self.razon_social
        return ' '.join(filter(None, [self.nombre1, self.nombre2,
                                       self.apellido1, self.apellido2]))
