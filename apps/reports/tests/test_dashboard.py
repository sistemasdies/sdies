"""Tests de los datos del Dashboard: estado de resultados sin cierre y cumpleaños."""
import datetime

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounting.models import Comprobante, Cuenta, CentroCosto, MoviCont, Tercero
from apps.users.models import Role, User

ESTADO = '/api/reports/estado-resultados/'
CUMPLE = '/api/terceros/cumpleanos/'
BALANCE_GENERAL = '/api/reports/balance-general/'
BALANCE_COMP = '/api/reports/balance-comprobacion/'


class EstadoResultadosCierreTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')
        self.client.force_authenticate(self.admin)

        self.cc = Comprobante.objects.create(codigo='CC', descripcion='Contabilidad')
        self.z  = Comprobante.objects.create(codigo='zCierre', descripcion='Cierre')

        self.ingreso = Cuenta.objects.create(codigo='4135', descripcion='Ventas',
                                             naturaleza='C', es_detalle=True)
        self.gasto   = Cuenta.objects.create(codigo='5105', descripcion='Gastos',
                                             naturaleza='D', es_detalle=True)

        hoy = datetime.date.today()
        # Movimiento normal: ingreso 1000, gasto 400
        MoviCont.objects.create(cod_comprob=self.cc, num_comprob=1, item_comprob=1,
                                fecha=hoy, cuenta=self.ingreso, vr_debitos=0, vr_creditos=1000)
        MoviCont.objects.create(cod_comprob=self.cc, num_comprob=1, item_comprob=2,
                                fecha=hoy, cuenta=self.gasto, vr_debitos=400, vr_creditos=0)
        # Comprobante de cierre 'z': ingreso adicional 5000 que NO debe contarse al excluir
        MoviCont.objects.create(cod_comprob=self.z, num_comprob=1, item_comprob=1,
                                fecha=hoy, cuenta=self.ingreso, vr_debitos=0, vr_creditos=5000)

        self.rango = {'fecha_desde': f'{hoy.year}-01-01', 'fecha_hasta': str(hoy)}

    def test_sin_parametro_incluye_cierre(self):
        r = self.client.get(ESTADO, self.rango)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(float(r.data['ingresos']), 6000.0)
        self.assertEqual(float(r.data['gastos']), 400.0)

    def test_excluir_cierre_omite_comprobante_z(self):
        r = self.client.get(ESTADO, {**self.rango, 'excluir_cierre': '1'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(float(r.data['ingresos']), 1000.0)
        self.assertEqual(float(r.data['gastos']), 400.0)
        self.assertEqual(float(r.data['utilidad']), 600.0)


class CumpleanosTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')
        self.client.force_authenticate(self.admin)

        hoy = datetime.date.today()
        self.dentro = hoy + datetime.timedelta(days=3)
        self.lejos  = hoy + datetime.timedelta(days=40)

    def _tercero(self, cedula, fecha_nac):
        return Tercero.objects.create(cedula=cedula, tipo_persona='N',
                                      nombre1='Ana', apellido1='Lopez',
                                      fecha_nacimiento=fecha_nac)

    def test_lista_solo_proximos_10_dias(self):
        # fecha_nacimiento con año antiguo para conservar mes/día
        self._tercero('1', datetime.date(1990, self.dentro.month, self.dentro.day))
        self._tercero('2', datetime.date(1990, self.lejos.month, self.lejos.day))
        r = self.client.get(CUMPLE, {'dias': 10})
        self.assertEqual(r.status_code, 200)
        cedulas = [x['cedula'] for x in r.data['resultados']]
        self.assertIn('1', cedulas)
        self.assertNotIn('2', cedulas)
        self.assertEqual(r.data['resultados'][0]['dias'], 3)

    def test_ignora_terceros_sin_fecha(self):
        Tercero.objects.create(cedula='3', tipo_persona='N', nombre1='Sin', apellido1='Fecha')
        r = self.client.get(CUMPLE)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['resultados'], [])

    def test_ignora_mayores_de_120(self):
        hoy = datetime.date.today()
        dentro = hoy + datetime.timedelta(days=5)
        self._tercero('120', datetime.date(hoy.year - 119, dentro.month, dentro.day))
        self._tercero('121', datetime.date(hoy.year - 121, dentro.month, dentro.day))
        r = self.client.get(CUMPLE, {'dias': 10})
        self.assertEqual(r.status_code, 200)
        cedulas = [x['cedula'] for x in r.data['resultados']]
        self.assertIn('120', cedulas)
        self.assertNotIn('121', cedulas)

    def test_requiere_autenticacion(self):
        self.client.force_authenticate(None)
        r = self.client.get(CUMPLE)
        self.assertIn(r.status_code, (401, 403))


class EstadoResultadosScopeTest(TestCase):
    """El estado de resultados debe respetar el alcance del rol."""

    def setUp(self):
        self.client = APIClient()
        self.cc = Comprobante.objects.create(codigo='CC', descripcion='Contabilidad')
        self.ce = Comprobante.objects.create(codigo='CE', descripcion='Egreso')
        self.c4135 = Cuenta.objects.create(codigo='4135', descripcion='Ventas', naturaleza='C')
        self.c4175 = Cuenta.objects.create(codigo='4175', descripcion='Servicios', naturaleza='C')
        self.centro1 = CentroCosto.objects.create(codigo='01', descripcion='Uno')
        self.centro2 = CentroCosto.objects.create(codigo='02', descripcion='Dos')

        hoy = datetime.date.today()
        self._mov(self.cc, self.c4135, self.centro1, 1000, hoy)
        self._mov(self.cc, self.c4175, self.centro1, 2000, hoy)
        self._mov(self.ce, self.c4135, self.centro2, 3000, hoy)

        self.rango = {'fecha_desde': f'{hoy.year}-01-01', 'fecha_hasta': str(hoy)}

    def _mov(self, comprobante, cuenta, centro, valor, fecha):
        self._item = getattr(self, '_item', 0) + 1
        MoviCont.objects.create(cod_comprob=comprobante, num_comprob=1,
                                item_comprob=self._item, fecha=fecha, cuenta=cuenta,
                                centro_costo=centro, vr_debitos=0, vr_creditos=valor)

    def _usuario(self, **m2m):
        role = Role.objects.create(NameRole='RolTest')
        for campo, objetos in m2m.items():
            getattr(role, campo).set(objetos)
        user = User.objects.create_user(login='usuario', email='u@erp.local',
                                        password='Test2025*')
        user.role = role
        user.save()
        return user

    def test_sin_alcance_ve_todo(self):
        self.client.force_authenticate(self._usuario())
        r = self.client.get(ESTADO, self.rango)
        self.assertEqual(float(r.data['ingresos']), 6000.0)

    def test_alcance_por_cuenta(self):
        self.client.force_authenticate(self._usuario(cuentas=[self.c4135]))
        r = self.client.get(ESTADO, self.rango)
        self.assertEqual(float(r.data['ingresos']), 4000.0)

    def test_alcance_por_comprobante(self):
        self.client.force_authenticate(self._usuario(comprobantes=[self.cc]))
        r = self.client.get(ESTADO, self.rango)
        self.assertEqual(float(r.data['ingresos']), 3000.0)

    def test_alcance_por_centro_costo(self):
        self.client.force_authenticate(self._usuario(centros_costo=[self.centro2]))
        r = self.client.get(ESTADO, self.rango)
        self.assertEqual(float(r.data['ingresos']), 3000.0)

    def test_balance_general_respeta_alcance(self):
        self.client.force_authenticate(self._usuario(cuentas=[self.c4135]))
        r = self.client.get(BALANCE_GENERAL, {'fecha_hasta': self.rango['fecha_hasta']})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(float(r.data['ingresos']), 4000.0)

    def test_balance_comprobacion_respeta_alcance(self):
        self.client.force_authenticate(self._usuario(comprobantes=[self.cc]))
        r = self.client.get(BALANCE_COMP, self.rango)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(float(r.data['totales']['creditos']), 3000.0)
        self.assertEqual(float(r.data['totales']['saldo']), -3000.0)
