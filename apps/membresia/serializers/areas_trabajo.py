from rest_framework import serializers

from apps.membresia.models import AreaTrabajo


class AreaTrabajoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AreaTrabajo
        fields = ['codigo_area', 'nombre_area', 'descripcion_area', 'comentarios_area']

    def validate_codigo_area(self, value):
        value = value.strip()
        if self.instance and value != self.instance.codigo_area:
            raise serializers.ValidationError('No se puede modificar el código del área.')
        return value

    def validate_nombre_area(self, value):
        return value.strip()

    def validate_descripcion_area(self, value):
        return value.strip()
