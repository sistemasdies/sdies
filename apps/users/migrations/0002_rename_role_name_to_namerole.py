from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='role',
            old_name='name',
            new_name='NameRole',
        ),
        migrations.AlterField(
            model_name='role',
            name='NameRole',
            field=models.CharField(max_length=10, unique=True),
        ),
    ]