from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0003_merge_0002_initial_0002_simplificar_comprobante'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='tercero',
            name='fecha_exp_cedula',
        ),
    ]
