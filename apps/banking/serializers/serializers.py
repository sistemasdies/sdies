from rest_framework import serializers
from apps.banking.models import CuentaBancaria, TransaccionBancaria, ConciliacionBancaria


class CuentaBancariaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CuentaBancaria
        fields = ['id', 'nombre', 'banco', 'numero_cuenta', 'tipo', 'moneda',
                  'cuenta_contable', 'saldo_inicial', 'fecha_apertura',
                  'is_active', 'swift', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        return CuentaBancaria.objects.create(
            created_by=self.context['request'].user,
            **validated_data
        )


class TransaccionBancariaSerializer(serializers.ModelSerializer):
    tipo_display   = serializers.CharField(source='get_tipo_display',   read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model  = TransaccionBancaria
        fields = ['id', 'cuenta_bancaria', 'fecha', 'descripcion', 'referencia',
                  'tipo', 'tipo_display', 'monto', 'saldo', 'estado', 'estado_display',
                  'asiento', 'origen', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        return TransaccionBancaria.objects.create(
            created_by=self.context['request'].user,
            **validated_data
        )


class ConciliacionBancariaSerializer(serializers.ModelSerializer):
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model  = ConciliacionBancaria
        fields = ['id', 'cuenta_bancaria', 'periodo', 'fecha_extracto',
                  'saldo_extracto', 'saldo_libros', 'diferencia',
                  'estado', 'estado_display', 'notas',
                  'cerrada_por', 'fecha_cierre', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        return ConciliacionBancaria.objects.create(
            created_by=self.context['request'].user,
            **validated_data
        )
