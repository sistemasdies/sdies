from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_alter_role_namerole'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='fecha_cierre',
            field=models.DateField(blank=True, null=True),
        ),
    ]