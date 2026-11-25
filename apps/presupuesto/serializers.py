from rest_framework import serializers
from .models import Presupuesto


class PresupuestoSerializer(serializers.ModelSerializer):
    cuenta_codigo = serializers.CharField(source='cuenta.codigo', read_only=True)
    cuenta_nombre = serializers.CharField(source='cuenta.descripcion', read_only=True)
    centro_costo_codigo = serializers.CharField(source='centro_costo.codigo', read_only=True)
    centro_costo_nombre = serializers.CharField(source='centro_costo.descripcion', read_only=True)

    class Meta:
        model = Presupuesto
        fields = [
            'id', 'anio', 'cuenta', 'cuenta_codigo', 'cuenta_nombre',
            'centro_costo', 'centro_costo_codigo', 'centro_costo_nombre',
            'monto_mensual', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class GenerarPresupuestoSerializer(serializers.Serializer):
    anio = serializers.IntegerField(min_value=2000, max_value=2100)
    porcentaje_incremento = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, default=0
    )
    fecha_desde = serializers.DateField()
    fecha_hasta = serializers.DateField()
    centros_costo = serializers.ListField(
        child=serializers.CharField(max_length=7),
        required=False,
        allow_empty=True,
    )

    def validate(self, data):
        if data['fecha_desde'] > data['fecha_hasta']:
            raise serializers.ValidationError('La fecha desde no puede ser mayor que la fecha hasta.')
        return data
