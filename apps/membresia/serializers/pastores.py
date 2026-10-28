from rest_framework import serializers

from apps.membresia.models import Pastor


class PastorSerializer(serializers.ModelSerializer):
    pastor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Pastor
        fields = [
            'id', 'codigo_pastor', 'pastor_nombre',
            'tipo_licencia',
            'nombre_pastor_postulante',
            'fecha_licencia_fase1', 'lugar_aprobado_fase1', 'aprobado_fase1_por',
            'fecha_licencia_fase2', 'lugar_aprobado_fase2', 'aprobado_fase2_por',
            'fecha_licencia_general', 'lugar_aprobado_general', 'aprobado_general_por',
            'fecha_licencia_ordenacion', 'lugar_aprobado_ordenacion', 'aprobado_ordenacion_por',
            'comentarios', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'pastor_nombre']

    def get_pastor_nombre(self, obj):
        if not obj.codigo_pastor_id:
            return ''
        return obj.codigo_pastor.nombre_completo

    def validate_codigo_pastor(self, value):
        # value puede venir como string (cédula) o instancia; normalizar a instancia ya lo hace DRF.
        return value