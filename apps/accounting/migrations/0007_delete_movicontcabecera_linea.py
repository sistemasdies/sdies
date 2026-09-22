from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0006_create_movicont'),
        ('banking', '0003_asiento_movicont'),
    ]

    operations = [
        migrations.DeleteModel(
            name='MoviContCabecera',
        ),
        migrations.DeleteModel(
            name='MoviContLinea',
        ),
    ]
