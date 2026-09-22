from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0004_remove_fecha_exp_cedula'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tercero',
            name='tipo_documento',
            field=models.CharField(blank=True, max_length=2),
        ),
    ]
