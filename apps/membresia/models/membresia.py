from django.db import models

from apps.core.models.base import BaseModel


class EstadoMembresia(models.TextChoices):
    ACTIVO    = '1', 'Activo'
    AUSENTE   = '2', 'Ausente'
    VACACIONES = '3', 'Vacaciones'
    TRASLADADO = '4', 'Trasladado'
    ENFERMO   = '5', 'Enfermo'
    APARTADO  = '6', 'Apartado'


class EstadoCivil(models.TextChoices):
    SOLTERO    = '1', 'Soltero'
    CASADO     = '2', 'Casado'
    DIVORCIADO = '3', 'Divorciado'
    SEPARADO   = '4', 'Separado'
    VIUDO      = '5', 'Viudo'


class TipoMatrimonio(models.TextChoices):
    CIVIL      = 'C', 'Civil'
    JUZGADO    = 'J', 'Juzgado'
    RELIGIOSO  = 'R', 'Religioso'
    ALCALDIA   = 'A', 'Alcaldía'


class Membresia(BaseModel):
    """Datos eclesiales de una persona natural registrada en accounting.Tercero."""

    # ── 1. Datos generales (verificados contra Tercero) ───────────────────
    tercero = models.OneToOneField(
        'accounting.Tercero', on_delete=models.PROTECT, to_field='cedula',
        related_name='membresia', verbose_name='Cédula',
    )

    # ── 2. Datos familiares ────────────────────────────────────────────────
    estado_civil          = models.CharField(max_length=1, choices=EstadoCivil.choices, blank=True)
    fecha_matrimonio      = models.DateField(null=True, blank=True)
    tipo_matrimonio       = models.CharField(max_length=1, choices=TipoMatrimonio.choices, blank=True)
    lugar_matrimonio      = models.CharField(max_length=30, blank=True)
    nombre_oficiado_por   = models.CharField(max_length=30, blank=True)
    nombre_papa           = models.CharField(max_length=30, blank=True)
    nombre_mama           = models.CharField(max_length=30, blank=True)
    nombre_conyuge        = models.CharField(max_length=30, blank=True)
    personas_a_cargo      = models.IntegerField(default=0)
    comentario_familiar   = models.TextField(blank=True)
    folio_reg_civil       = models.CharField(max_length=12, blank=True)
    oficina_reg_civil     = models.CharField(max_length=30, blank=True)
    lugar_fallecimiento   = models.CharField(max_length=30, blank=True)
    fecha_fallecido       = models.DateField(null=True, blank=True)

    # ── 3. Datos académicos y laborales ───────────────────────────────────
    escolaridad             = models.CharField(max_length=30, blank=True)
    profesion               = models.CharField(max_length=30, blank=True)
    ocupacion               = models.CharField(max_length=30, blank=True)
    lugar_de_trabajo        = models.CharField(max_length=30, blank=True)
    telefono_trabajo        = models.CharField(max_length=20, blank=True)
    comentarios_academico_laboral = models.TextField(blank=True)

    # ── 4. Datos eclesiales ───────────────────────────────────────────────
    estado                 = models.CharField(max_length=1, choices=EstadoMembresia.choices,
                                             default=EstadoMembresia.ACTIVO)
    comentarios_eclesiales = models.TextField(blank=True)

    congregacion = models.ForeignKey(
        'congregacion.Congregacion', null=True, blank=True,
        on_delete=models.SET_NULL, to_field='codigo',
        related_name='membresias',
        verbose_name='Congregación',
    )

    sw_bautizado           = models.BooleanField(default=False)
    serial_bautismo        = models.IntegerField(null=True, blank=True)
    fecha_bautismo         = models.DateField(null=True, blank=True)
    lugar_bautismo         = models.CharField(max_length=30, blank=True)
    pastor_que_bautizo     = models.CharField(max_length=30, blank=True)

    sw_promesado           = models.BooleanField(default=False)
    serial_membresia       = models.IntegerField(null=True, blank=True)
    fecha_promesado        = models.DateField(null=True, blank=True)
    lugar_promesado        = models.CharField(max_length=30, blank=True)

    congregacion_anterior  = models.CharField(max_length=30, blank=True)
    salio_para             = models.CharField(max_length=30, blank=True)
    fecha_llegada          = models.DateField(null=True, blank=True)
    fecha_salida           = models.DateField(null=True, blank=True)

    class Meta:
        ordering            = ['tercero__apellido1', 'tercero__nombre1']
        verbose_name        = 'Membresía'
        verbose_name_plural = 'Membresías'
        indexes = [models.Index(fields=['estado'])]

    def __str__(self):
        return f"{self.tercero_id} - {self.tercero.nombre_completo}"

    @property
    def nombre_completo(self):
        return self.tercero.nombre_completo
