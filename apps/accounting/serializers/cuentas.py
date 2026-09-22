from rest_framework import serializers
from apps.accounting.models import Cuenta


class CuentaSerializer(serializers.ModelSerializer):
    padre_codigo        = serializers.CharField(source='padre.codigo',      read_only=True)
    padre_descripcion   = serializers.CharField(source='padre.descripcion', read_only=True)
    hijos_count         = serializers.SerializerMethodField()
    clase_aptig_display = serializers.CharField(read_only=True)

    class Meta:
        model  = Cuenta
        fields = [
            'id', 'codigo', 'descripcion', 'nivel', 'naturaleza',
            'tipo_pgmd', 'clase_aptig', 'clase_aptig_display',
            'padre', 'padre_codigo', 'padre_descripcion',
            'es_detalle', 'is_active', 'permite_cc', 'hijos_count', 'created_at',
        ]
        # padre y clase_aptig los calcula el modelo en save() — son de solo lectura
        read_only_fields = ['id', 'created_at', 'padre', 'clase_aptig']

    def get_hijos_count(self, obj):
        return obj.hijos.filter(deleted=False).count()

    def validate_naturaleza(self, value):
        if value and value.upper() not in {'D', 'C'}:
            raise serializers.ValidationError("naturaleza debe ser D o C.")
        return value.upper() if value else value

    def create(self, validated_data):
        return Cuenta.objects.create(**validated_data)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class CuentaArbolSerializer(serializers.ModelSerializer):
    hijos               = serializers.SerializerMethodField()
    clase_aptig_display = serializers.CharField(read_only=True)

    class Meta:
        model  = Cuenta
        fields = ['id', 'codigo', 'descripcion', 'nivel', 'naturaleza',
                  'tipo_pgmd', 'clase_aptig', 'clase_aptig_display',
                  'es_detalle', 'is_active', 'hijos']

    def get_hijos(self, obj):
        return CuentaArbolSerializer(
            obj.hijos.filter(deleted=False, is_active=True).order_by('codigo'),
            many=True).data