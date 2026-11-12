from rest_framework import serializers
from apps.accounting.models import Tercero
class TerceroSerializer(serializers.ModelSerializer):
    nombre_completo  = serializers.CharField(read_only=True)
    class Meta:
        model  = Tercero
        fields = [
            'id','cedula','tipo_persona',
            'nombre1','nombre2','apellido1','apellido2','razon_social',
            'nombre_completo','fecha_nacimiento',
            'lugar_nacimiento','sexo','direccion','barrio',
            'codigo_postal','distrito',
            'telefono1','celular','fax','email',
            'latitud','longitud','comentarios','is_active','created_at',
        ]
        read_only_fields = ['id','created_at']
