from django.db import migrations

MODULOS = [
    ('membresias', 'Membresía'),
    ('congregaciones', 'Congregaciones'),
    ('estados', 'Estados'),
]
ACTIONS = ['acceder', 'listar', 'agregar', 'editar', 'borrar']


def crear_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for module, label in MODULOS:
        for act in ACTIONS:
            Permission.objects.get_or_create(
                code=f'{module}.{act}',
                defaults={'name': f'{label} — {act}', 'module': module},
            )


def eliminar_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(module__in=[m for m, _ in MODULOS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0014_user_centro_costo_user'),
    ]

    operations = [
        migrations.RunPython(crear_permisos, eliminar_permisos),
    ]