from rest_framework import serializers

from apps.membresia.models import EquipoTrabajo


class EquipoTrabajoSerializer(serializers.ModelSerializer):
    area_trabajo_nombre = serializers.SerializerMethodField()
    cargo_nombre = serializers.SerializerMethodField()
    congregacion_nombre = serializers.SerializerMethodField()
    responsable_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EquipoTrabajo
        fields = [
            'id', 'area_trabajo', 'area_trabajo_nombre',
            'cargo', 'cargo_nombre',
            'congregacion', 'congregacion_nombre',
            'responsable', 'responsable_nombre',
            'vigencia_desde', 'vigencia_hasta',
            'comentarios', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'area_trabajo_nombre',
                            'cargo_nombre', 'congregacion_nombre', 'responsable_nombre']

    def get_area_trabajo_nombre(self, obj):
        return obj.area_trabajo.nombre_area if obj.area_trabajo else ''

    def get_cargo_nombre(self, obj):
        return obj.cargo.nombre_cargo if obj.cargo else ''

    def get_congregacion_nombre(self, obj):
        return obj.congregacion.nombre if obj.congregacion else ''

    def get_responsable_nombre(self, obj):
        return obj.responsable.nombre_completo if obj.responsable else ''

    def validate(self, data):
        area = data.get('area_trabajo')
        cargo = data.get('cargo')
        responsable = data.get('responsable')
        if not area:
            raise serializers.ValidationError({'area_trabajo': 'El área de trabajo es obligatoria.'})
        if not cargo:
            raise serializers.ValidationError({'cargo': 'El cargo es obligatorio.'})
        if not responsable:
            raise serializers.ValidationError({'responsable': 'El responsable es obligatorio.'})
        return data
