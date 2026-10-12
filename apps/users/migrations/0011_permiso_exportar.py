from django.db import migrations

MODULE = 'exportar'
LABEL = 'Exportar Datos'
ACTIONS = ['acceder', 'listar', 'agregar', 'editar', 'borrar']


def crear_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')

    nuevos = {}
    for act in ACTIONS:
        perm, _ = Permission.objects.get_or_create(
            code=f'{MODULE}.{act}',
            defaults={'name': f'{LABEL} — {act}', 'module': MODULE},
        )
        nuevos[act] = perm

    # Quien puede importar datos también puede exportarlos.
    for act, perm in nuevos.items():
        for role in Role.objects.filter(permissions__code=f'importar.{act}'):
            role.permissions.add(perm)


def eliminar_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(module=MODULE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_alter_user_fecha_cierre'),
    ]

    operations = [
        migrations.RunPython(crear_permisos, eliminar_permisos),
    ]
