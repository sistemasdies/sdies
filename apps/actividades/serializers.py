from rest_framework import serializers

from apps.actividades.models import Acontecimiento, FotoAcontecimiento, Asistencia, Visitacion
from apps.users.services.scopes import user_scope


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
    subtotal = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = Asistencia
        fields = [
            'id', 'fecha', 'congregacion', 'congregacion_nombre',
            'creyentes', 'simpatizantes', 'visitas', 'subtotal', 'ninos', 'online',
            'tema_predicacion', 'comentarios', 'total',
        ]
        read_only_fields = ['id']

    def get_congregacion_nombre(self, obj):
        return obj.congregacion.nombre if obj.congregacion_id else ''

    def get_subtotal(self, obj):
        return (obj.creyentes or 0) + (obj.simpatizantes or 0) + (obj.visitas or 0)

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


class VisitacionSerializer(serializers.ModelSerializer):
    congregacion_nombre = serializers.SerializerMethodField()
    visitado_cedula     = serializers.SerializerMethodField()
    visitado_nombre     = serializers.SerializerMethodField()
    responsable_cedula  = serializers.SerializerMethodField()
    responsable_nombre  = serializers.SerializerMethodField()
    modo_label          = serializers.SerializerMethodField()

    class Meta:
        model = Visitacion
        fields = [
            'id', 'item', 'congregacion', 'congregacion_nombre',
            'fecha', 'modo', 'modo_label',
            'visitado', 'visitado_cedula', 'visitado_nombre',
            'objeto_visita', 'comentarios',
            'responsable', 'responsable_cedula', 'responsable_nombre',
        ]
        read_only_fields = ['id', 'item']

    def get_congregacion_nombre(self, obj):
        return obj.congregacion.nombre if obj.congregacion_id else ''

    def get_visitado_cedula(self, obj):
        return obj.visitado.tercero.cedula if obj.visitado_id and obj.visitado.tercero_id else ''

    def get_visitado_nombre(self, obj):
        return obj.visitado.nombre_completo if obj.visitado_id else ''

    def get_responsable_cedula(self, obj):
        return obj.responsable.tercero.cedula if obj.responsable_id and obj.responsable.tercero_id else ''

    def get_responsable_nombre(self, obj):
        return obj.responsable.nombre_completo if obj.responsable_id else ''

    def get_modo_label(self, obj):
        return dict(Visitacion.MODO_CHOICES).get(obj.modo, obj.modo)

    def validate(self, data):
        if not data.get('congregacion'):
            raise serializers.ValidationError({'congregacion': 'La congregación es obligatoria.'})
        if not data.get('fecha'):
            raise serializers.ValidationError({'fecha': 'La fecha es obligatoria.'})
        if not data.get('visitado'):
            raise serializers.ValidationError({'visitado': 'El visitado es obligatorio.'})
        if not data.get('responsable'):
            raise serializers.ValidationError({'responsable': 'El responsable es obligatorio.'})

        request = self.context.get('request')
        if request:
            scope = user_scope(request.user)
            if scope['congregaciones'] is not None:
                cong = data.get('congregacion')
                if cong and cong.codigo not in scope['congregaciones']:
                    raise serializers.ValidationError({'congregacion': 'No tiene permiso para esta congregación.'})
                visitado = data.get('visitado')
                if visitado and visitado.congregacion_id not in scope['congregaciones']:
                    raise serializers.ValidationError({'visitado': 'El miembro visitado no pertenece a una congregación permitida.'})
                responsable = data.get('responsable')
                if responsable and responsable.congregacion_id not in scope['congregaciones']:
                    raise serializers.ValidationError({'responsable': 'El responsable no pertenece a una congregación permitida.'})
        return data

    def create(self, validated_data):
        congregacion = validated_data['congregacion']
        ultimo = Visitacion.objects.filter(congregacion=congregacion).order_by('item').last()
        validated_data['item'] = (ultimo.item + 1) if ultimo else 1
        return super().create(validated_data)
