import bleach
from bleach.css_sanitizer import CSSSanitizer
from rest_framework import serializers

from apps.actas.models import ActaReunion, ActaFirma


ALLOWED_TAGS = [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote',
    'a', 'span', 'div', 'sub', 'sup',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'img',
]

ALLOWED_ATTRIBUTES = {
    '*': ['class', 'style'],
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'width', 'height'],
}

ALLOWED_STYLES = [
    'color', 'background-color', 'font-size', 'font-family',
    'font-weight', 'font-style', 'text-decoration',
    'text-align', 'line-height', 'margin', 'padding',
]


def sanitizar_html(html):
    if html is None:
        return ''
    css_sanitizer = CSSSanitizer(allowed_css_properties=ALLOWED_STYLES)
    return bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        css_sanitizer=css_sanitizer,
        strip=True,
    )


class ActaFirmaSerializer(serializers.ModelSerializer):
    nombre = serializers.SerializerMethodField()

    class Meta:
        model = ActaFirma
        fields = [
            'id', 'acta', 'usuario', 'miembro', 'nombre',
            'fecha_firma', 'tipo_firma', 'confirmacion_doc',
        ]
        read_only_fields = ['id', 'acta', 'fecha_firma', 'tipo_firma']

    def get_nombre(self, obj):
        if obj.usuario:
            return obj.usuario.NameUser or obj.usuario.login
        if obj.miembro:
            return obj.miembro.nombre_completo
        return '—'


class ActaReunionSerializer(serializers.ModelSerializer):
    congregacion_nombre = serializers.CharField(source='congregacion.nombre', read_only=True)
    autor_nombre        = serializers.CharField(source='autor.NameUser', read_only=True)
    firmas              = ActaFirmaSerializer(many=True, read_only=True)
    total_firmas        = serializers.IntegerField(source='firmas.count', read_only=True)
    firmas_completadas  = serializers.IntegerField(read_only=True)

    class Meta:
        model = ActaReunion
        fields = [
            'id', 'congregacion', 'congregacion_nombre', 'codigo',
            'titulo', 'tipo', 'fecha_reunion', 'contenido', 'estado',
            'autor', 'autor_nombre', 'firmas', 'total_firmas',
            'firmas_completadas', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'autor', 'created_at', 'updated_at']

    def validate_contenido(self, value):
        return sanitizar_html(value)

    def validate_codigo(self, value):
        return str(value).strip()

    def validate_titulo(self, value):
        return value.strip()

    def validate(self, attrs):
        congregacion = attrs.get('congregacion')
        codigo = attrs.get('codigo')
        if congregacion and codigo:
            qs = ActaReunion.objects.filter(congregacion=congregacion, codigo=codigo)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {'codigo': 'Ya existe un acta con este código para la congregación seleccionada.'}
                )
        return attrs

    def get_firmas_completadas(self, obj):
        return obj.firmas.filter(fecha_firma__isnull=False).count()
