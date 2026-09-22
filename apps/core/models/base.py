import uuid
from django.db import models
from django.utils import timezone


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted=False)

class AllObjectsManager(models.Manager):
    pass


class BaseModel(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='%(app_label)s_%(class)s_created', editable=False)
    updated_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='%(app_label)s_%(class)s_updated', editable=False)
    deleted    = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='%(app_label)s_%(class)s_deleted', editable=False)

    objects     = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True
        ordering = ['-created_at']

    def soft_delete(self, user=None):
        self.deleted    = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save(update_fields=['deleted','deleted_at','deleted_by','updated_at'])

    def restore(self):
        self.deleted    = False
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=['deleted','deleted_at','deleted_by','updated_at'])
