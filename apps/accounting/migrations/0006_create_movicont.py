import uuid

import django.db.models.deletion
from django.db import migrations, models


def copiar_datos(apps, schema_editor):
    MoviCont = apps.get_model('accounting', 'MoviCont')
    Linea    = apps.get_model('accounting', 'MoviContLinea')

    rows = []
    for l in Linea.objects.all().select_related('cabecera').iterator():
        rows.append(MoviCont(
            id=l.id,
            cod_comprob_id=l.cabecera.cod_comprob_id,
            num_comprob=l.cabecera.num_comprob,
            item_comprob=l.item_comprob,
            fecha=l.fecha or l.cabecera.fecha,
            cuenta_id=l.cuenta_id,
            doc_ref=l.doc_ref or l.cabecera.doc_ref,
            observacion=l.observacion,
            cedula_id=l.tercero_id,
            centro_costo_id=l.centro_costo_id,
            doc_soporte=l.doc_soporte or l.cabecera.doc_soporte,
            vr_debitos=l.vr_debitos,
            vr_creditos=l.vr_creditos,
            created_by_id=l.created_by_id,
            updated_by_id=l.updated_by_id,
            created_at=l.created_at,
            updated_at=l.updated_at,
            deleted=l.deleted,
            deleted_at=l.deleted_at,
            deleted_by_id=l.deleted_by_id,
        ))
    MoviCont.objects.bulk_create(rows, batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0005_alter_tercero_tipo_documento'),
    ]

    operations = [
        migrations.CreateModel(
            name='MoviCont',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accounting_movicont_created', to='users.user')),
                ('updated_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accounting_movicont_updated', to='users.user')),
                ('deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('deleted_by', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accounting_movicont_deleted', to='users.user')),
                ('cod_comprob', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='movimientos', to='accounting.comprobante', to_field='codigo')),
                ('num_comprob', models.IntegerField()),
                ('item_comprob', models.SmallIntegerField()),
                ('fecha', models.DateField(db_index=True)),
                ('cuenta', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='movimientos', to='accounting.cuenta', to_field='codigo')),
                ('doc_ref', models.CharField(blank=True, max_length=14)),
                ('observacion', models.CharField(blank=True, max_length=200)),
                ('cedula', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='movimientos', to='accounting.tercero', to_field='cedula')),
                ('centro_costo', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='movimientos', to='accounting.centrocosto', to_field='codigo')),
                ('doc_soporte', models.CharField(blank=True, max_length=15)),
                ('vr_debitos', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('vr_creditos', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
            ],
            options={
                'verbose_name': 'Movimiento contable',
                'verbose_name_plural': 'Movimientos contables',
                'ordering': ['fecha', 'num_comprob', 'item_comprob'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='movicont',
            unique_together={('cod_comprob', 'num_comprob', 'item_comprob')},
        ),
        migrations.AddIndex(
            model_name='movicont',
            index=models.Index(fields=['fecha'], name='accounting__fecha_bb124c_idx'),
        ),
        migrations.AddIndex(
            model_name='movicont',
            index=models.Index(fields=['num_comprob'], name='accounting__num_com_ecff0d_idx'),
        ),
        migrations.RunPython(copiar_datos, migrations.RunPython.noop),
    ]
