from rest_framework import serializers
from apps.accounting.models import PeriodoContable
class PeriodoContableSerializer(serializers.ModelSerializer):
    estado_display     = serializers.CharField(source='get_estado_display', read_only=True)
    cerrado_por_nombre = serializers.CharField(source='cerrado_por.get_full_name', read_only=True)
    class Meta:
        model  = PeriodoContable
        fields = ['id','anio','mes','nombre','fecha_inicio','fecha_fin','estado','estado_display',
                  'cerrado_por','cerrado_por_nombre','fecha_cierre','notas_cierre','created_at']
        read_only_fields = ['id','nombre','estado','cerrado_por','fecha_cierre','created_at']
