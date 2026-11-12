from django.db import migrations


MODULE = 'saldos_meses'
LABEL = 'Saldos Meses/Años'
ACTIONS = ['acceder', 'listar', 'agregar', 'editar', 'borrar']


def crear_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for act in ACTIONS:
        Permission.objects.get_or_create(
            code=f'{MODULE}.{act}',
            defaults={'name': f'{LABEL} — {act}', 'module': MODULE},
        )


def eliminar_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(module=MODULE).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0027_permisos_auxiliares'),
    ]

    operations = [
        migrations.RunPython(crear_permisos, eliminar_permisos),
    ]
