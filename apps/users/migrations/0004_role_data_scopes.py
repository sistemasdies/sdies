from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_rename_nombre_to_nameuser'),
        ('accounting', '__first__'),
    ]

    operations = [
        migrations.AddField(
            model_name='role',
            name='centros_costo',
            field=models.ManyToManyField(blank=True, related_name='roles', to='accounting.centrocosto'),
        ),
        migrations.AddField(
            model_name='role',
            name='cuentas',
            field=models.ManyToManyField(blank=True, related_name='roles', to='accounting.cuenta'),
        ),
        migrations.AddField(
            model_name='role',
            name='comprobantes',
            field=models.ManyToManyField(blank=True, related_name='roles', to='accounting.comprobante'),
        ),
    ]