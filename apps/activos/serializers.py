from rest_framework import serializers

from apps.activos.models import Categoria, Ubicacion, EstadoActivoF, ActivoF, FotoActivoF


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['categoria', 'nombre_categoria']

    def validate_categoria(self, value):
        return value.strip().upper()

    def validate_nombre_categoria(self, value):
        return value.strip()


class UbicacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ubicacion
        fields = ['ubicacion', 'descripcion']

    def validate_ubicacion(self, value):
        return value.strip().upper()

    def validate_descripcion(self, value):
        return value.strip()


class EstadoActivoFSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoActivoF
        fields = ['estado_activo_f', 'descripcion_estado_activo_f']

    def validate_estado_activo_f(self, value):
        value = value.strip()
        if self.instance and value != self.instance.estado_activo_f:
            raise serializers.ValidationError('No se puede modificar el código del estado.')
        return value

    def validate_descripcion_estado_activo_f(self, value):
        return value.strip()


class ActivoFSerializer(serializers.ModelSerializer):
    congregacion_nombre = serializers.SerializerMethodField()
    responsable_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ActivoF
        fields = [
            'id_activo_f', 'nombre_activo_f', 'cantidad', 'categoria', 'marca', 'modelo',
            'numero_serie', 'congregacion', 'congregacion_nombre', 'ubicacion',
            'responsable', 'responsable_nombre', 'estado_actual',
            'fecha_adquisicion', 'valor_compra', 'comentarios',
        ]

    def get_congregacion_nombre(self, obj):
        if not obj.congregacion_id:
            return ''
        return obj.congregacion.nombre

    def get_responsable_nombre(self, obj):
        if not obj.responsable_id:
            return ''
        return obj.responsable.nombre_completo

    def validate_id_activo_f(self, value):
        value = value.strip().upper()
        if self.instance and value != self.instance.id_activo_f:
            raise serializers.ValidationError('No se puede modificar el código del activo.')
        return value


class FotoActivoFSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoActivoF
        fields = ['id', 'activo', 'url', 'public_id', 'orden', 'descripcion', 'created_at']
        read_only_fields = ['id', 'created_at']