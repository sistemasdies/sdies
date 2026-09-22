import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('banking', '0002_initial'),
        ('accounting', '0006_create_movicont'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transaccionbancaria',
            name='asiento',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transacciones_bancarias', to='accounting.movicont'),
        ),
    ]
