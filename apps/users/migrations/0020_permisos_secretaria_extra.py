from django.db import migrations


MODULOS = [
    ('cargos', 'Cargos', ['acceder', 'listar', 'agregar', 'editar', 'borrar']),
    ('areas_trabajo', 'Áreas de Trabajo', ['acceder', 'listar', 'agregar', 'editar', 'borrar']),
    ('equipos_trabajo', 'Equipos de Trabajo', ['acceder', 'listar', 'agregar', 'editar', 'borrar']),
]


def crear_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for module, label, actions in MODULOS:
        for act in actions:
            Permission.objects.get_or_create(
                code=f'{module}.{act}',
                defaults={'name': f'{label} — {act}', 'module': module},
            )


def eliminar_permisos(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for module, _, _ in MODULOS:
        Permission.objects.filter(module=module).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0019_permiso_vista_rapida'),
    ]

    operations = [
        migrations.RunPython(crear_permisos, eliminar_permisos),
    ]
