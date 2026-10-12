"""Tests de los endpoints de Corrección de Datos (preview / aplicar)."""
import datetime

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounting.models import (
    Comprobante, Cuenta, CentroCosto, DetallePlantilla, MoviCont,
    PlantillaContable, Tercero,
)
from apps.audit.models import AuditLog
from apps.users.models import Permission, Role, User

PREVIEW = '/api/correccion-datos/preview/'
APLICAR = '/api/correccion-datos/aplicar/'


def _rol_con_acceder(login):
    role = Role.objects.create(NameRole=f'Rol-{login}')
    perm, _ = Permission.objects.get_or_create(
        code='correccion_datos.acceder',
        defaults={'name': 'Corrección de Datos — acceder', 'module': 'correccion_datos'})
    role.permissions.add(perm)
    user = User.objects.create_user(login=login, email=f'{login}@erp.local',
                                    password='Test2025*')
    user.role = role
    user.save()
    return user


class CorreccionDatosBase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')
        self.client.force_authenticate(self.admin)

        self.comprobante = Comprobante.objects.create(codigo='CC', descripcion='Contabilidad')
        self.cuenta = Cuenta.objects.create(codigo='110505', descripcion='Caja general',
                                            es_detalle=True, is_active=True)
        self.cuenta2 = Cuenta.objects.create(codigo='110510', descripcion='Cajas menores',
                                             es_detalle=True, is_active=True)
        self.centro = CentroCosto.objects.create(codigo='01', descripcion='Principal')
        self.tercero = Tercero.objects.create(cedula='1001', tipo_persona='N',
                                              nombre1='Ana', apellido1='Lopez')

        self.m1 = MoviCont.objects.create(
            cod_comprob=self.comprobante, num_comprob=1, item_comprob=1,
            fecha=datetime.date(2025, 6, 1), cuenta=self.cuenta,
            observacion='Diezmo enero', centro_costo=self.centro,
            vr_debitos=100, vr_creditos=0)
        self.m2 = MoviCont.objects.create(
            cod_comprob=self.comprobante, num_comprob=1, item_comprob=2,
            fecha=datetime.date(2025, 6, 1), cuenta=self.cuenta,
            observacion='Diezmo febrero', centro_costo=self.centro,
            vr_debitos=0, vr_creditos=100)
        self.m3 = MoviCont.objects.create(
            cod_comprob=self.comprobante, num_comprob=2, item_comprob=1,
            fecha=datetime.date(2024, 6, 1), cuenta=self.cuenta,
            observacion='Ofrenda', centro_costo=self.centro,
            vr_debitos=50, vr_creditos=0)


class PreviewTest(CorreccionDatosBase):

    def test_preview_cuenta_y_muestra(self):
        r = self.client.post(PREVIEW, {'tabla': 'movicont',
                                       'filtros': {'observacion': 'Diezmo'}}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['total'], 2)
        self.assertEqual(len(r.data['muestra']), 2)
        self.assertTrue(any(c['campo'] == 'cuenta' for c in r.data['campos_editables']))

    def test_preview_tabla_invalida(self):
        r = self.client.post(PREVIEW, {'tabla': 'nope', 'filtros': {}}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_preview_filtra_por_rango_fechas(self):
        r = self.client.post(PREVIEW, {'tabla': 'movicont',
                                       'filtros': {'fecha_desde': '2025-01-01',
                                                   'fecha_hasta': '2025-12-31'}}, format='json')
        self.assertEqual(r.data['total'], 2)


class AplicarTest(CorreccionDatosBase):

    def test_requiere_confirmacion(self):
        r = self.client.post(APLICAR, {'tabla': 'movicont', 'filtros': {'observacion': 'Diezmo'},
                                       'campo': 'observacion', 'valor': 'X'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_campo_no_editable(self):
        r = self.client.post(APLICAR, {'tabla': 'movicont', 'filtros': {},
                                       'campo': 'num_comprob', 'valor': '9',
                                       'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_actualiza_observacion_en_bloque(self):
        r = self.client.post(APLICAR, {'tabla': 'movicont', 'filtros': {'observacion': 'Diezmo'},
                                       'campo': 'observacion', 'valor': 'Diezmo 2025',
                                       'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['actualizados'], 2)
        self.m1.refresh_from_db(); self.m2.refresh_from_db(); self.m3.refresh_from_db()
        self.assertEqual(self.m1.observacion, 'Diezmo 2025')
        self.assertEqual(self.m2.observacion, 'Diezmo 2025')
        self.assertEqual(self.m3.observacion, 'Ofrenda')

    def test_cambio_de_cuenta_valida_existencia(self):
        r = self.client.post(APLICAR, {'tabla': 'movicont', 'filtros': {'observacion': 'Diezmo'},
                                       'campo': 'cuenta', 'valor': '999999',
                                       'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cambio_de_cuenta_ok(self):
        r = self.client.post(APLICAR, {'tabla': 'movicont', 'filtros': {'observacion': 'Diezmo'},
                                       'campo': 'cuenta', 'valor': '110510',
                                       'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.m1.refresh_from_db()
        self.assertEqual(self.m1.cuenta_id, '110510')

    def test_cambiar_debitos_pone_creditos_en_cero(self):
        r = self.client.post(APLICAR, {'tabla': 'movicont', 'filtros': {'observacion': 'Diezmo'},
                                       'campo': 'vr_debitos', 'valor': '250',
                                       'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.m2.refresh_from_db()
        self.assertEqual(str(self.m2.vr_debitos), '250.00')
        self.assertEqual(str(self.m2.vr_creditos), '0.00')

    def test_registra_auditoria(self):
        self.client.post(APLICAR, {'tabla': 'movicont', 'filtros': {'observacion': 'Diezmo'},
                                   'campo': 'observacion', 'valor': 'X',
                                   'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertTrue(AuditLog.objects.filter(action='BULK_UPDATE').exists())

    def test_det_plantillas_actualiza_tipo_mov(self):
        p = PlantillaContable.objects.create(cod_plantilla='P1', nombre='Ingresos')
        DetallePlantilla.objects.create(plantilla=p, item=1, cuenta='110505', tipo_mov='D')
        r = self.client.post(APLICAR, {'tabla': 'det_plantillas', 'filtros': {'plantilla': ['P1']},
                                       'campo': 'tipo_mov', 'valor': 'C',
                                       'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(DetallePlantilla.objects.get(item=1).tipo_mov, 'C')

    def test_plantillas_actualiza_nombre(self):
        PlantillaContable.objects.create(cod_plantilla='P1', nombre='Ingresos')
        r = self.client.post(APLICAR, {'tabla': 'plantillas', 'filtros': {'cod_plantilla': 'P1'},
                                       'campo': 'nombre', 'valor': 'Ingresos varios',
                                       'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(PlantillaContable.objects.get(cod_plantilla='P1').nombre, 'Ingresos varios')


class FechaCierreTest(CorreccionDatosBase):

    def test_bloquea_movimientos_con_fecha_anterior_al_cierre(self):
        user = _rol_con_acceder('cierre')
        user.fecha_cierre = datetime.date(2025, 12, 31)
        user.save()
        self.client.force_authenticate(user)
        r = self.client.post(APLICAR, {'tabla': 'movicont', 'filtros': {'observacion': 'Diezmo'},
                                       'campo': 'observacion', 'valor': 'X',
                                       'confirmacion': 'CONFIRMAR'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.m1.refresh_from_db()
        self.assertEqual(self.m1.observacion, 'Diezmo enero')


class PermisosTest(TestCase):

    def setUp(self):
        self.client = APIClient()

    def test_requiere_autenticacion(self):
        r = self.client.post(PREVIEW, {'tabla': 'movicont', 'filtros': {}}, format='json')
        self.assertIn(r.status_code, (401, 403))

    def test_rechaza_usuario_sin_permiso(self):
        user = User.objects.create_user(login='normal', email='n@erp.local', password='Test2025*')
        self.client.force_authenticate(user)
        r = self.client.post(PREVIEW, {'tabla': 'movicont', 'filtros': {}}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_permite_usuario_con_permiso(self):
        user = _rol_con_acceder('corr')
        self.client.force_authenticate(user)
        r = self.client.post(PREVIEW, {'tabla': 'movicont', 'filtros': {}}, format='json')
        self.assertEqual(r.status_code, 200)
