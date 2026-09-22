from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(model_name='comprobante', name='ruta_imagen'),
        migrations.RemoveField(model_name='comprobante', name='regimen'),
        migrations.RemoveField(model_name='comprobante', name='resolucion'),
        migrations.RemoveField(model_name='comprobante', name='rango_desde'),
        migrations.RemoveField(model_name='comprobante', name='rango_hasta'),
        migrations.RemoveField(model_name='comprobante', name='fecha'),
        migrations.RemoveField(model_name='comprobante', name='ica'),
        migrations.RemoveField(model_name='comprobante', name='observaciones1'),
        migrations.RemoveField(model_name='comprobante', name='observaciones2'),
        migrations.RemoveField(model_name='comprobante', name='observaciones3'),
    ]
