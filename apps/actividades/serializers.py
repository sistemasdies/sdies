from rest_framework import serializers

from apps.actividades.models import Acontecimiento, FotoAcontecimiento, Asistencia


class FotoAcontecimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoAcontecimiento
        fields = ['id', 'url', 'public_id', 'orden', 'descripcion', 'created_at']
        read_only_fields = ['id', 'created_at']


class AcontecimientoSerializer(serializers.ModelSerializer):
    congregacion_nombre = serializers.SerializerMethodField()
    fotos = FotoAcontecimientoSerializer(many=True, read_only=True)
    cantidad_fotos = serializers.SerializerMethodField()

    class Meta:
        model = Acontecimiento
        fields = [
            'id', 'item', 'congregacion', 'congregacion_nombre',
            'fecha', 'titulo', 'comentarios', 'fotos', 'cantidad_fotos',
        ]
        read_only_fields = ['id', 'item']

    def get_congregacion_nombre(self, obj):
        return obj.congregacion.nombre if obj.congregacion_id else ''

    def get_cantidad_fotos(self, obj):
        return obj.fotos.count()

    def validate(self, data):
        congregacion = data.get('congregacion')
        if not congregacion:
            raise serializers.ValidationError({'congregacion': 'La congregación es obligatoria.'})
        return data

    def create(self, validated_data):
        congregacion = validated_data['congregacion']
        ultimo = Acontecimiento.objects.filter(congregacion=congregacion).order_by('item').last()
        validated_data['item'] = (ultimo.item + 1) if ultimo else 1
        return super().create(validated_data)


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
