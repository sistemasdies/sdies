from django.db import migrations

MODULO_GENERAR = 'generar_presupuesto'
MODULO_CONTROL = 'presupuesto'
ACTIONS = ['acceder', 'listar', 'agregar', 'editar', 'borrar']


def aplicar(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')

    # El área existente pasa a llamarse "Presupuesto vs Real".
    for act in ACTIONS:
        Permission.objects.filter(module=MODULO_CONTROL, code=f'{MODULO_CONTROL}.{act}').update(
            name=f'Presupuesto vs Real — {act}'
        )

    # Nueva área independiente para el módulo Generar Presupuesto.
    for act in ACTIONS:
        Permission.objects.get_or_create(
            code=f'{MODULO_GENERAR}.{act}',
            defaults={'name': f'Generar Presupuesto — {act}', 'module': MODULO_GENERAR},
        )

    admin = Role.objects.filter(NameRole='Administrador').first()
    if admin:
        admin.permissions.add(*Permission.objects.filter(module=MODULO_GENERAR))


def revertir(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for act in ACTIONS:
        Permission.objects.filter(module=MODULO_CONTROL, code=f'{MODULO_CONTROL}.{act}').update(
            name=f'Presupuesto — {act}'
        )
    Permission.objects.filter(module=MODULO_GENERAR).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0030_permisos_presupuesto'),
    ]

    operations = [
        migrations.RunPython(aplicar, revertir),
    ]
