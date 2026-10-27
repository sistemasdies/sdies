from rest_framework import serializers

from apps.membresia.models import EstadoMembresia


class EstadoMembresiaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EstadoMembresia
        fields = ['estado', 'descripcion']

    def validate_estado(self, value):
        value = value.strip()
        if self.instance and value != self.instance.estado:
            raise serializers.ValidationError('No se puede modificar el código del estado.')
        return value

    def validate_descripcion(self, value):
        return value.strip()
