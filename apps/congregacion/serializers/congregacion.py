from rest_framework import serializers

from apps.congregacion.models import Congregacion


class CongregacionSerializer(serializers.ModelSerializer):
    pastor_nombre = serializers.SerializerMethodField()

    class Meta:
        model  = Congregacion
        fields = ['id', 'codigo', 'nombre', 'direccion',
                  'pastor', 'pastor_nombre', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_pastor_nombre(self, obj):
        if not obj.pastor_id:
            return ''
        return obj.pastor.nombre_completo

    def validate_codigo(self, value):
        value = value.strip().upper()
        qs = Congregacion.all_objects.filter(codigo=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f'Ya existe una congregación con el código "{value}".')
        return value

    def validate_nombre(self, value):
        return value.strip()
