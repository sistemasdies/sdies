import uuid
from django.db import models

class AuditLog(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp   = models.DateTimeField(auto_now_add=True, db_index=True)
    user        = models.ForeignKey('users.User', null=True, on_delete=models.SET_NULL,
                                    related_name='audit_logs')
    action      = models.CharField(max_length=20)
    resource    = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=100)
    before_data = models.JSONField(null=True, blank=True)
    after_data  = models.JSONField(null=True, blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    user_agent  = models.CharField(max_length=500, blank=True)
    endpoint    = models.CharField(max_length=300, blank=True)
    http_method = models.CharField(max_length=10, blank=True)
    extra       = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes  = [
            models.Index(fields=['resource','resource_id']),
            models.Index(fields=['user','timestamp']),
            models.Index(fields=['action','timestamp']),
        ]

    def __str__(self):
        return f"{self.action} {self.resource}/{self.resource_id} @ {self.timestamp:%Y-%m-%d %H:%M}"
