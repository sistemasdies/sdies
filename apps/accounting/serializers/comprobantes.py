from rest_framework import serializers
from apps.accounting.models import Comprobante


class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Comprobante
        fields = ['id', 'codigo', 'descripcion', 'numero_inicial', 'activo', 'created_at']
        read_only_fields = ['id', 'created_at']
