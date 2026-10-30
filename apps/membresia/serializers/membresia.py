from django.db import transaction
from rest_framework import serializers

from apps.accounting.models import Tercero
from apps.membresia.models import Membresia


CAMPOS_TERCERO = [
    'cedula', 'tipo_documento', 'tipo_persona', 'nombre1', 'nombre2',
    'apellido1', 'apellido2', 'lugar_exp_cedula', 'fecha_nacimiento',
    'lugar_nacimiento', 'sexo', 'direccion', 'barrio', 'codigo_postal',
    'distrito', 'telefono1', 'celular', 'email',
    'comentarios',
]


class TerceroReferenciaSerializer(serializers.ModelSerializer):
    """Sección 1 — datos generales. Escribible: alimenta accounting.Tercero."""

    # Sin UniqueValidator: la cédula identifica un tercero que puede ya existir.
    cedula         = serializers.CharField(max_length=12, required=True, trim_whitespace=True)
    nombre_completo = serializers.CharField(read_only=True)

    class Meta:
        model  = Tercero
        fields = CAMPOS_TERCERO + ['nombre_completo']
        read_only_fields = ['nombre_completo']


class MembresiaSerializer(serializers.ModelSerializer):
    tercero            = TerceroReferenciaSerializer()
    nombre_completo    = serializers.CharField(read_only=True)
    congregacion_nombre = serializers.SerializerMethodField()
    tiene_notas_pastor = serializers.BooleanField(read_only=True)
    tiene_notas_misionero = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Membresia
        fields = [
            'id', 'tercero', 'nombre_completo',
            'estado_civil', 'fecha_matrimonio', 'tipo_matrimonio',
            'lugar_matrimonio', 'nombre_oficiado_por', 'nombre_papa',
            'nombre_mama', 'nombre_conyuge', 'personas_a_cargo',
            'comentario_familiar', 'folio_reg_civil', 'oficina_reg_civil',
            'lugar_fallecimiento', 'fecha_fallecido',
            'escolaridad', 'profesion', 'ocupacion', 'lugar_de_trabajo',
            'telefono_trabajo', 'comentarios_academico_laboral',
            'estado', 'comentarios_eclesiales',
            'congregacion', 'congregacion_nombre',
            'tiene_notas_pastor', 'tiene_notas_misionero',
            'foto',
            'sw_bautizado', 'serial_bautismo', 'fecha_bautismo',
            'lugar_bautismo', 'pastor_que_bautizo',
            'sw_promesado', 'serial_membresia', 'fecha_promesado',
            'lugar_promesado', 'congregacion_anterior', 'salio_para',
            'fecha_llegada', 'fecha_salida', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'congregacion_nombre', 'foto']

    def get_congregacion_nombre(self, obj):
        if not obj.congregacion_id:
            return ''
        return obj.congregacion.nombre

    def validate(self, data):
        tercero_data = data.get('tercero') or {}
        instance     = self.instance

        if instance is None:
            cedula = (tercero_data.get('cedula') or '').strip()
            if not cedula:
                raise serializers.ValidationError({'tercero': {'cedula': 'La cédula es obligatoria.'}})
            # all_objects: una membresía dada de baja sigue ocupando la relación.
            if Membresia.all_objects.filter(tercero_id=cedula).exists():
                raise serializers.ValidationError(
                    {'tercero': {'cedula': 'Esta cédula ya tiene una membresía registrada.'}})
        else:
            cedula = (tercero_data.get('cedula') or instance.tercero_id).strip()
            if cedula != instance.tercero_id:
                raise serializers.ValidationError(
                    {'tercero': {'cedula': 'La cédula no se puede modificar.'}})

        return data

    def _resolver_tercero(self, tercero_data, user):
        """Crea el tercero si no existe; si existe, actualiza los datos generales."""
        tercero_data = dict(tercero_data)
        cedula       = (tercero_data.pop('cedula') or '').strip()
        tercero      = Tercero.all_objects.filter(cedula=cedula).first()

        if tercero is None:
            tercero_data.setdefault('tipo_persona', 'N')
            tercero = Tercero(**tercero_data, cedula=cedula, created_by=user)
            tercero.save()
            return tercero

        if tercero.deleted:
            tercero.deleted    = False
            tercero.deleted_at = None
            tercero.deleted_by = None
        for campo, valor in tercero_data.items():
            setattr(tercero, campo, valor)
        tercero.updated_by = user
        tercero.save()
        return tercero

    @transaction.atomic
    def create(self, validated_data):
        user         = self.context['request'].user
        tercero_data = dict(validated_data.pop('tercero'))
        validated_data['tercero']    = self._resolver_tercero(tercero_data, user)
        validated_data['created_by'] = user
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        user         = self.context['request'].user
        tercero_data = validated_data.pop('tercero', None)
        if tercero_data:
            instance.tercero = self._resolver_tercero(dict(tercero_data), user)
        instance.updated_by = user
        return super().update(instance, validated_data)
