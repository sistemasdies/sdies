from rest_framework import serializers
from apps.accounting.models import Tercero
class TerceroSerializer(serializers.ModelSerializer):
    nombre_completo  = serializers.CharField(read_only=True)
    tipo_documento   = serializers.CharField(required=False, allow_blank=True)
    class Meta:
        model  = Tercero
        fields = [
            'id','cedula','tipo_documento','tipo_persona',
            'nombre1','nombre2','apellido1','apellido2','razon_social',
            'nombre_completo','lugar_exp_cedula','fecha_nacimiento',
            'lugar_nacimiento','sexo','direccion','barrio',
            'municipio','departamento','distrito',
            'telefono1','telefono2','celular','fax','email',
            'comentarios','is_active','created_at',
        ]
        read_only_fields = ['id','created_at']
