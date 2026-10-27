from rest_framework import serializers

from apps.accounting.models import Tercero
from apps.membresia.models import AnotacionPastor, AnotacionMisionero


class _AnotacionBaseSerializer(serializers.ModelSerializer):
    cedula_firma_nombre = serializers.SerializerMethodField()

    class Meta:
        fields = ['id', 'cedula', 'fecha', 'anotacion', 'cedula_firma',
                  'cedula_firma_nombre', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'cedula_firma_nombre']

    def get_cedula_firma_nombre(self, obj):
        if not obj.cedula_firma_id:
            return ''
        return obj.cedula_firma.nombre_completo


class AnotacionPastorSerializer(_AnotacionBaseSerializer):
    class Meta(_AnotacionBaseSerializer.Meta):
        model = AnotacionPastor


class AnotacionMisioneroSerializer(_AnotacionBaseSerializer):
    class Meta(_AnotacionBaseSerializer.Meta):
        model = AnotacionMisionero