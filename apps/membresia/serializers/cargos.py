from rest_framework import serializers

from apps.membresia.models import Cargo


class CargoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cargo
        fields = ['codigo_cargo', 'nombre_cargo']

    def validate_codigo_cargo(self, value):
        value = value.strip().upper()
        if self.instance and value != self.instance.codigo_cargo:
            raise serializers.ValidationError('No se puede modificar el código del cargo.')
        return value

    def validate_nombre_cargo(self, value):
        return value.strip()
