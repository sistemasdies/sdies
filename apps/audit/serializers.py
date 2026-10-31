from rest_framework import serializers
from .models import AuditLog
class AuditLogSerializer(serializers.ModelSerializer):
    user_nombre = serializers.CharField(source='user.NameUser', read_only=True)
    user_login  = serializers.CharField(source='user.login', read_only=True)
    class Meta:
        model  = AuditLog
        fields = ['id','timestamp','user','user_nombre','user_login','action','resource',
                  'resource_id','before_data','after_data','ip_address',
                  'endpoint','http_method','extra']
