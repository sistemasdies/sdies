from django.db import migrations

MODULE = 'correccion_datos'
LABEL = 'Corrección de Datos'
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

    # Quien puede importar/exportar datos también puede corregirlos.
    for act, perm in nuevos.items():
        for role in Role.objects.filter(permissions__code=f'importar.{act}'):
            role.permissions.add(perm)


def eliminar_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(module=MODULE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_permiso_exportar'),
    ]

    operations = [
        migrations.RunPython(crear_permisos, eliminar_permisos),
    ]
