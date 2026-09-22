from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_rename_role_name_to_namerole'),
    ]

    operations = [
        migrations.RenameField(
            model_name='user',
            old_name='nombre',
            new_name='NameUser',
        ),
        migrations.AlterField(
            model_name='user',
            name='NameUser',
            field=models.CharField(max_length=30),
        ),
        migrations.AddField(
            model_name='user',
            name='caja_user',
            field=models.CharField(max_length=8, blank=True, default=''),
        ),
    ]