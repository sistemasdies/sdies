from django.db import migrations


def backfill_preferencias(apps, schema_editor):
    User = apps.get_model('users', 'User')
    UserPreference = apps.get_model('users', 'UserPreference')
    for user in User.objects.all():
        UserPreference.objects.get_or_create(user=user)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_userpreference'),
    ]

    operations = [
        migrations.RunPython(backfill_preferencias, migrations.RunPython.noop),
    ]
