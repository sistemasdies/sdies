from django.db import migrations

MODULE = 'presupuesto'
LABEL = 'Presupuesto'
ACTIONS = ['acceder', 'listar', 'agregar', 'editar', 'borrar']


def crear_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    for act in ACTIONS:
        Permission.objects.get_or_create(
            code=f'{MODULE}.{act}',
            defaults={'name': f'{LABEL} — {act}', 'module': MODULE},
        )

    admin = Role.objects.filter(NameRole='Administrador').first()
    if admin:
        perms = Permission.objects.filter(module=MODULE)
        admin.permissions.add(*perms)


def eliminar_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(module=MODULE).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0029_permisos_visitacion'),
    ]

    operations = [
        migrations.RunPython(crear_permisos, eliminar_permisos),
    ]
