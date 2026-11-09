from django.db import migrations


def eliminar_permisos_actividades(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(module='actividades').delete()


def crear_permisos_actividades(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for act in ['acceder', 'listar', 'agregar', 'editar', 'borrar']:
        Permission.objects.get_or_create(
            code=f'actividades.{act}',
            defaults={'name': f'Actividades — {act}', 'module': 'actividades'},
        )


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0024_permisos_acontecimientos'),
    ]

    operations = [
        migrations.RunPython(eliminar_permisos_actividades, crear_permisos_actividades),
    ]
