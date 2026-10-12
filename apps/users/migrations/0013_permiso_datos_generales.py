from django.db import migrations
from django.db.models import Q

MODULE = 'datos_generales'
LABEL = 'Datos Generales'
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

    # Quien administra usuarios (rol administrador) también configura la organización.
    roles = Role.objects.filter(
        Q(permissions__code='usuarios.editar') | Q(NameRole='Administrador')
    ).distinct()
    for act, perm in nuevos.items():
        for role in roles:
            role.permissions.add(perm)


def eliminar_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(module=MODULE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0012_permiso_correccion_datos'),
    ]

    operations = [
        migrations.RunPython(crear_permisos, eliminar_permisos),
    ]
