from rest_framework import serializers
from apps.accounting.models import CentroCosto
class CentroCostoSerializer(serializers.ModelSerializer):
    responsable_nombre = serializers.SerializerMethodField()
    class Meta:
        model  = CentroCosto
        fields = ['id','codigo','descripcion','responsable','responsable_nombre','is_active','created_at']
        read_only_fields = ['id','created_at']
    def get_responsable_nombre(self, obj):
        return obj.responsable.nombre_completo if obj.responsable else ''
