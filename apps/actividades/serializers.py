from rest_framework import serializers

from apps.actividades.models import Asistencia


class AsistenciaSerializer(serializers.ModelSerializer):
    congregacion_nombre = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = Asistencia
        fields = [
            'id', 'fecha', 'congregacion', 'congregacion_nombre',
            'creyentes', 'simpatizantes', 'visitas', 'ninos', 'online',
            'tema_predicacion', 'comentarios', 'total',
        ]
        read_only_fields = ['id']

    def get_congregacion_nombre(self, obj):
        return obj.congregacion.nombre if obj.congregacion_id else ''

    def get_total(self, obj):
        return (obj.creyentes or 0) + (obj.simpatizantes or 0) + (obj.visitas or 0) + (obj.ninos or 0)

    def validate(self, data):
        for campo in ('creyentes', 'simpatizantes', 'visitas', 'ninos', 'online'):
            val = data.get(campo, 0)
            if val is not None and val < 0:
                raise serializers.ValidationError({campo: 'El valor no puede ser negativo.'})
        return data

    def validate_tema_predicacion(self, value):
        return (value or '').strip()
