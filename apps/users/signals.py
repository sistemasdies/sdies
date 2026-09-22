from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

User = get_user_model()


@receiver(post_save, sender=User)
def crear_preferencias(sender, instance, created, **kwargs):
    """Crea el registro de preferencias al crear un usuario."""
    if created:
        from .models import UserPreference
        UserPreference.objects.get_or_create(user=instance)
