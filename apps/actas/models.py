import secrets
from django.db import models
from django.utils import timezone

from apps.core.models.base import BaseModel


class ActaReunion(BaseModel):
    ESTADO_BORRADOR   = '1'
    ESTADO_REVISADA   = '2'
    ESTADO_FIRMADA    = '3'
    ESTADO_ARCHIVADA  = '4'

    ESTADOS = [
        (ESTADO_BORRADOR,  'Borrador'),
        (ESTADO_REVISADA,  'Revisada'),
        (ESTADO_FIRMADA,   'Firmada'),
        (ESTADO_ARCHIVADA, 'Archivada'),
    ]

    congregacion  = models.ForeignKey(
        'congregacion.Congregacion', on_delete=models.PROTECT,
        to_field='codigo', related_name='actas',
        verbose_name='Congregación',
    )
    codigo        = models.CharField(max_length=7, verbose_name='Código')
    titulo        = models.CharField(max_length=50, verbose_name='Título')
    tipo          = models.CharField(max_length=20, verbose_name='Tipo de reunión')
    fecha_reunion = models.DateField(verbose_name='Fecha de la reunión')
    contenido     = models.TextField(verbose_name='Contenido')
    estado        = models.CharField(
        max_length=1, choices=ESTADOS, default=ESTADO_BORRADOR,
        verbose_name='Estado',
    )
    autor         = models.ForeignKey(
        'users.User', on_delete=models.PROTECT,
        related_name='actas_autor', verbose_name='Autor',
    )

    class Meta:
        db_table = 'actas_reunion'
        verbose_name = 'Acta de reunión'
        verbose_name_plural = 'Actas de reunión'
        unique_together = [('congregacion', 'codigo')]
        ordering = ['-fecha_reunion', '-codigo']

    def __str__(self):
        return f'{self.codigo} - {self.titulo}'


class ActaFirma(models.Model):
    TIPO_PASSWORD   = 'password'
    TIPO_TOKEN      = 'token'
    TIPO_GRAFICA    = 'grafica'
    TIPO_SECRETARIO = 'secretario'

    TIPOS_FIRMA = [
        (TIPO_PASSWORD,   'Contraseña'),
        (TIPO_TOKEN,      'Enlace/token por correo'),
        (TIPO_GRAFICA,    'Firma gráfica'),
        (TIPO_SECRETARIO, 'Registrada por secretario'),
    ]

    acta              = models.ForeignKey(
        ActaReunion, on_delete=models.CASCADE,
        related_name='firmas', verbose_name='Acta',
    )
    usuario           = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.PROTECT,
        related_name='firmas_usuario', verbose_name='Usuario',
    )
    miembro           = models.ForeignKey(
        'membresia.Membresia', null=True, blank=True, on_delete=models.PROTECT,
        related_name='firmas_miembro', verbose_name='Miembro',
    )
    token             = models.CharField(max_length=64, blank=True, verbose_name='Token')
    token_expira      = models.DateTimeField(null=True, blank=True, verbose_name='Expiración del token')
    fecha_firma       = models.DateTimeField(null=True, blank=True, verbose_name='Fecha de firma')
    tipo_firma        = models.CharField(
        max_length=20, choices=TIPOS_FIRMA, blank=True,
        verbose_name='Tipo de firma',
    )
    ip_firma          = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP')
    firma_imagen      = models.ImageField(
        upload_to='firmas/%Y/%m/', null=True, blank=True,
        verbose_name='Imagen de firma',
    )
    confirmacion_doc  = models.CharField(
        max_length=30, blank=True, verbose_name='Documento de confirmación',
    )
    correo_enviado    = models.DateTimeField(
        null=True, blank=True, verbose_name='Fecha de envío del correo',
    )

    class Meta:
        db_table = 'actas_firma'
        verbose_name = 'Firma de acta'
        verbose_name_plural = 'Firmas de actas'
        unique_together = [
            ('acta', 'usuario'),
            ('acta', 'miembro'),
        ]

    def __str__(self):
        persona = self.usuario or self.miembro
        return f'Firma {self.tipo_firma or "pendiente"} de {persona} en {self.acta}'

    def generar_token(self):
        self.token = secrets.token_urlsafe(32)
        self.token_expira = timezone.now() + timezone.timedelta(days=7)
        return self.token
