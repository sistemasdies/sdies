from rest_framework import serializers
from .models import AuditLog
class AuditLogSerializer(serializers.ModelSerializer):
    user_nombre = serializers.CharField(source='user.get_full_name', read_only=True)
    class Meta:
        model  = AuditLog
        fields = ['id','timestamp','user','user_nombre','action','resource',
                  'resource_id','before_data','after_data','ip_address',
                  'endpoint','http_method','extra']
