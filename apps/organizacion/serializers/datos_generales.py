from rest_framework import serializers

from apps.accounting.models import Tercero
from apps.organizacion.models import DatosGenerales

# Campos que llegan como cadena vacía desde el formulario y deben guardarse vacíos.
CAMPOS_VACIOS_A_NULO = ('CedulaPresidente',)


class DatosGeneralesSerializer(serializers.ModelSerializer):
    # Se maneja por cédula (el modelo usa to_field='cedula').
    CedulaPresidente = serializers.SlugRelatedField(
        slug_field='cedula', allow_null=True, required=False,
        queryset=Tercero.objects.all())
    presidente_nombre = serializers.SerializerMethodField()

    class Meta:
        model  = DatosGenerales
        fields = [
            'id', 'NombreOrganizacion', 'NIT', 'direccion', 'telefono', 'email',
            'CedulaPresidente', 'presidente_nombre', 'ciudad', 'pais',
            'LogoDeLaOrganizacion', 'logoDeLaApp', 'FondoDeLaApp', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']

    def get_presidente_nombre(self, obj):
        if not obj.CedulaPresidente_id:
            return ''
        return obj.CedulaPresidente.nombre_completo

    def to_internal_value(self, data):
        # Permite "limpiar" una imagen o el presidente enviando cadena vacía ('' -> None).
        if hasattr(data, 'copy'):
            data = data.copy()
            for campo in CAMPOS_VACIOS_A_NULO:
                if data.get(campo) == '':
                    data[campo] = None
        return super().to_internal_value(data)
