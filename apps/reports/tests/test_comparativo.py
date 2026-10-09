"""Tests del informe Comparativo de Meses (ventana de 12 meses móviles)."""
import datetime
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounting.models import Comprobante, Cuenta, CentroCosto, MoviCont, Tercero
from apps.reports.services.comparativo import comparativo_meses, PeriodoInvalido


class ComparativoBase(TestCase):
    """Datos base: un comprobante, un centro de costo y dos terceros."""

    def setUp(self):
        from apps.users.models import User
        self.admin = User.objects.create_superuser(
            login='tester', email='tester@erp.local', password='Test2025*')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = '/api/reports/comparativo-meses/'

        self.comp = Comprobante.objects.create(codigo='CC01', descripcion='Comprobante')
        self.cc = CentroCosto.objects.create(codigo='01', descripcion='Principal')

        # 4 = Ingreso (naturaleza crédito), 5 = Gasto (naturancia débito)
        self.ing = Cuenta.objects.create(codigo='4135', descripcion='Donaciones')
        self.gas = Cuenta.objects.create(codigo='5110', descripcion='Sueldos')
        self.activo = Cuenta.objects.create(codigo='1105', descripcion='Caja')

        self.t1 = Tercero.objects.create(cedula='1001', tipo_persona='N',
                                         nombre1='Ana', apellido1='Lopez')
        self.t2 = Tercero.objects.create(cedula='1002', tipo_persona='N',
                                         nombre1='Luis', apellido1='Diaz')

        self.seq = 0

    def _mov(self, fecha, cuenta, deb=Decimal('0'), cre=Decimal('0'),
             cedula=None, comprobante=None, centro=None):
        self.seq += 1
        return MoviCont.objects.create(
            cod_comprob=comprobante or self.comp,
            num_comprob=1, item_comprob=self.seq, fecha=fecha,
            cuenta=cuenta, centro_costo=centro or self.cc,
            cedula=cedula, vr_debitos=deb, vr_creditos=cre)


class VentanaDeMesesTest(ComparativoBase):

    def test_enero_da_doce_meses_del_mismo_anio(self):
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['inicio_iso'], '2026-01')
        self.assertEqual(r['fin_iso'], '2026-12')
        self.assertEqual(r['etiquetas'][0], 'Ene')
        self.assertEqual(r['etiquetas'][-1], 'Dic')
        self.assertEqual(len(r['etiquetas']), 12)
        self.assertEqual(r['fecha_desde'], '2026-01-01')
        self.assertEqual(r['fecha_hasta'], '2026-12-31')

    def test_mes_intermedio_cruza_al_anio_siguiente(self):
        r = comparativo_meses(inicio='2026-03')
        self.assertEqual(r['inicio_iso'], '2026-03')
        self.assertEqual(r['fin_iso'], '2027-02')
        self.assertEqual(r['subetiquetas'][0], '2026')
        self.assertEqual(r['subetiquetas'][-1], '2027')
        self.assertEqual(r['fecha_hasta'], '2027-02-28')

    def test_diciembre_cierra_en_diciembre_del_anio_siguiente(self):
        r = comparativo_meses(inicio='2026-12')
        self.assertEqual(r['inicio_iso'], '2026-12')
        self.assertEqual(r['fin_iso'], '2027-11')

    def test_mes_invalido_es_rechazado(self):
        with self.assertRaises(PeriodoInvalido):
            comparativo_meses(inicio='2026-13')
        with self.assertRaises(PeriodoInvalido):
            comparativo_meses(inicio='marzo')

    def test_api_responde_400_con_mes_invalido(self):
        r = self.client.get(self.url, {'inicio': 'xyz'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('YYYY-MM', str(r.data.get('detail')))


class AgrupacionPorAniosTest(ComparativoBase):
    """Modo años: 12 columnas con el año, no nombres de mes."""

    def test_doce_anios_desde_el_anio_inicial(self):
        r = comparativo_meses(inicio='2014', agrupacion='anio')
        self.assertEqual(r['agrupacion'], 'anio')
        self.assertEqual(r['inicio_iso'], '2014')
        self.assertEqual(r['fin_iso'], '2025')
        self.assertEqual(r['etiquetas'][0], '2014')
        self.assertEqual(r['etiquetas'][-1], '2025')
        self.assertEqual(len(r['etiquetas']), 12)
        self.assertEqual(r['subetiquetas'], [''] * 12)
        self.assertEqual(r['etiqueta_total_periodo'], 'Total 12 años')
        self.assertEqual(r['fecha_desde'], '2014-01-01')
        self.assertEqual(r['fecha_hasta'], '2025-12-31')

    def test_acumula_todo_el_ano_en_una_columna(self):
        self._mov(datetime.date(2014, 1, 10), self.ing, cre=Decimal('100'))
        self._mov(datetime.date(2014, 7, 10), self.ing, cre=Decimal('250'))
        self._mov(datetime.date(2015, 3, 10), self.ing, cre=Decimal('60'))
        r = comparativo_meses(inicio='2014', agrupacion='anio')
        self.assertEqual(r['filas'][0]['valores'][0], '350.00')   # 2014
        self.assertEqual(r['filas'][0]['valores'][1], '60.00')    # 2015
        self.assertEqual(r['filas'][0]['valores'][2], '0.00')     # 2016
        self.assertEqual(r['total_ingresos_periodo'], '410.00')

    def test_fuera_del_rango_de_anios_se_excluye(self):
        self._mov(datetime.date(2013, 12, 31), self.ing, cre=Decimal('900'))
        self._mov(datetime.date(2026, 6, 1), self.ing, cre=Decimal('900'))
        self._mov(datetime.date(2020, 5, 5), self.ing, cre=Decimal('25'))
        r = comparativo_meses(inicio='2014', agrupacion='anio')
        self.assertEqual(r['total_ingresos_periodo'], '25.00')
        self.assertEqual(r['filas'][0]['valores'][6], '25.00')    # 2020

    def test_superavit_por_anio(self):
        self._mov(datetime.date(2014, 2, 5), self.ing, cre=Decimal('1000'))
        self._mov(datetime.date(2014, 2, 6), self.gas, deb=Decimal('400'))
        self._mov(datetime.date(2016, 2, 6), self.gas, deb=Decimal('150'))
        r = comparativo_meses(inicio='2014', agrupacion='anio')
        self.assertEqual(r['superavit'][0], '600.00')   # 2014: 1000 - 400
        self.assertEqual(r['superavit'][1], '0.00')     # 2015
        self.assertEqual(r['superavit'][2], '-150.00')  # 2016
        self.assertEqual(r['superavit_periodo'], '450.00')

    def test_detalle_de_terceros_sigue_funcionando(self):
        self._mov(datetime.date(2014, 5, 5), self.gas, deb=Decimal('300'), cedula=self.t1)
        self._mov(datetime.date(2016, 5, 5), self.gas, deb=Decimal('50'), cedula=self.t2)
        r = comparativo_meses(inicio='2014', agrupacion='anio', detalle_terceros=True)
        cuenta = r['filas'][0]
        self.assertEqual(cuenta['valores'][0], '300.00')
        self.assertEqual(cuenta['valores'][2], '50.00')
        self.assertEqual([t['cedula'] for t in cuenta['terceros']], ['1001', '1002'])

    def test_anio_invalido_es_rechazado(self):
        with self.assertRaises(PeriodoInvalido):
            comparativo_meses(inicio='sx', agrupacion='anio')

    def test_api_modo_anios(self):
        self._mov(datetime.date(2019, 4, 5), self.ing, cre=Decimal('500'))
        r = self.client.get(self.url, {'inicio': '2019', 'agrupacion': 'anio'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['agrupacion'], 'anio')
        self.assertEqual(r.data['etiquetas'][0], '2019')
        self.assertEqual(r.data['etiqueta_total_periodo'], 'Total 12 años')
        self.assertEqual(r.data['superavit_periodo'], '500.00')

    def test_api_modo_anios_con_anio_invalido(self):
        r = self.client.get(self.url, {'inicio': 'abcd', 'agrupacion': 'anio'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('YYYY', str(r.data.get('detail')))

    def test_sin_agrupacion_usa_meses(self):
        r = self.client.get(self.url, {'inicio': '2026-01'})
        self.assertEqual(r.data['agrupacion'], 'mes')
        self.assertEqual(r.data['etiqueta_total_periodo'], 'Total 12 meses')

    def test_api_sin_inicio_usa_el_periodo_actual(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        hoy = datetime.date.today()
        self.assertEqual(r.data['inicio'], f'{hoy.year:04d}-{hoy.month:02d}')
        r = self.client.get(self.url, {'agrupacion': 'anio'})
        self.assertEqual(r.data['inicio'], f'{hoy.year:04d}')


class SignoPorNaturalezaTest(ComparativoBase):

    def test_cuenta_de_ingreso_suma_credito_menos_debito(self):
        self._mov(datetime.date(2026, 1, 10), self.ing, cre=Decimal('500'))
        self._mov(datetime.date(2026, 1, 20), self.ing, deb=Decimal('100'))
        r = comparativo_meses(inicio='2026-01')
        fila = r['filas'][0]
        self.assertEqual(fila['codigo'], '4135')
        self.assertEqual(fila['naturaleza'], 'C')
        self.assertEqual(fila['valores'][0], '400.00')  # 500 - 100
        self.assertEqual(fila['total'], '400.00')

    def test_cuenta_de_gasto_suma_debito_menos_credito(self):
        self._mov(datetime.date(2026, 1, 10), self.gas, deb=Decimal('700'))
        self._mov(datetime.date(2026, 1, 20), self.gas, cre=Decimal('200'))
        r = comparativo_meses(inicio='2026-01')
        fila = r['filas'][0]
        self.assertEqual(fila['codigo'], '5110')
        self.assertEqual(fila['naturaleza'], 'D')
        self.assertEqual(fila['valores'][0], '500.00')  # 700 - 200

    def test_ingresos_y_gastos_se_acumulan_por_separado(self):
        """El pie separa ingresos de gastos; el superávit es la diferencia."""
        self._mov(datetime.date(2026, 2, 5), self.ing, cre=Decimal('1000'))
        self._mov(datetime.date(2026, 2, 6), self.gas, deb=Decimal('600'))
        r = comparativo_meses(inicio='2026-01')
        ingresos = next(f for f in r['filas'] if f['codigo'] == '4135')
        gastos   = next(f for f in r['filas'] if f['codigo'] == '5110')
        self.assertEqual(ingresos['clase'], '4')
        self.assertEqual(gastos['clase'], '5')
        self.assertEqual(ingresos['valores'][1], '1000.00')  # Feb
        self.assertEqual(gastos['valores'][1], '600.00')     # Feb
        self.assertEqual(r['total_ingresos'][1], '1000.00')
        self.assertEqual(r['total_gastos'][1], '600.00')
        self.assertEqual(r['superavit'][1], '400.00')        # 1000 - 600
        self.assertEqual(r['superavit_periodo'], '400.00')

    def test_deficit_cuando_los_gastos_superan_los_ingresos(self):
        self._mov(datetime.date(2026, 1, 5), self.ing, cre=Decimal('300'))
        self._mov(datetime.date(2026, 1, 6), self.gas, deb=Decimal('900'))
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['total_ingresos'][0], '300.00')
        self.assertEqual(r['total_gastos'][0], '900.00')
        self.assertEqual(r['superavit'][0], '-600.00')
        self.assertEqual(r['superavit_periodo'], '-600.00')

    def test_el_superavit_suma_los_doce_meses(self):
        self._mov(datetime.date(2026, 1, 5), self.ing, cre=Decimal('100'))
        self._mov(datetime.date(2026, 6, 5), self.ing, cre=Decimal('200'))
        self._mov(datetime.date(2026, 6, 6), self.gas, deb=Decimal('50'))
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['total_ingresos_periodo'], '300.00')
        self.assertEqual(r['total_gastos_periodo'], '50.00')
        self.assertEqual(r['superavit_periodo'], '250.00')
        self.assertEqual(r['superavit'][0], '100.00')   # Ene
        self.assertEqual(r['superavit'][5], '150.00')   # Jun

    def test_las_filas_vienen_agrupadas_ingresos_luego_gastos(self):
        """El frontend intercala los subtotales, así que el orden debe ser estable."""
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('10'))
        self._mov(datetime.date(2026, 1, 6), self.ing, cre=Decimal('20'))
        Cuenta.objects.create(codigo='4136', descripcion='Otro ingreso')
        r = comparativo_meses(inicio='2026-01')
        clases = [f['clase'] for f in r['filas']]
        self.assertEqual(clases, sorted(clases, key=lambda c: {'4': 0, '5': 1}.get(c, 2)))
        self.assertEqual([f['codigo'] for f in r['filas']],
                         sorted(f['codigo'] for f in r['filas'] if f['clase'] == '4') +
                         ['5110'])

    def test_otros_cuentas_no_entran_en_ingresos_ni_en_gastos(self):
        self._mov(datetime.date(2026, 1, 5), self.activo, deb=Decimal('400'))
        r = comparativo_meses(inicio='2026-01', cuentas=['1105'])
        self.assertEqual(r['total_ingresos_periodo'], '0.00')
        self.assertEqual(r['total_gastos_periodo'], '0.00')
        self.assertEqual(r['total_otros_periodo'], '400.00')
        self.assertEqual(r['superavit_periodo'], '400.00')

    def test_cuenta_de_activo_no_aparece_sin_filtro(self):
        self._mov(datetime.date(2026, 1, 10), self.activo, deb=Decimal('999'))
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['filas'], [])

    def test_activo_si_aparece_si_se_selecciona_explicita(self):
        self._mov(datetime.date(2026, 1, 10), self.activo, deb=Decimal('999'))
        r = comparativo_meses(inicio='2026-01', cuentas=['1105'])
        self.assertEqual(r['filas'][0]['codigo'], '1105')
        self.assertEqual(r['filas'][0]['valores'][0], '999.00')


class SeleccionDeCuentasTest(ComparativoBase):

    def setUp(self):
        super().setUp()
        self.ing_hijo = Cuenta.objects.create(codigo='413501', descripcion='Donacion A')
        self.ing_nieto = Cuenta.objects.create(codigo='41350101', descripcion='Donacion A1')
        self.otro_ing = Cuenta.objects.create(codigo='4136', descripcion='Donaciones B')

    def test_seleccion_expande_descendientes_por_prefijo(self):
        self._mov(datetime.date(2026, 1, 5), self.ing_hijo, cre=Decimal('100'))
        self._mov(datetime.date(2026, 1, 6), self.ing_nieto, cre=Decimal('50'))
        self._mov(datetime.date(2026, 1, 7), self.otro_ing, cre=Decimal('999'))
        r = comparativo_meses(inicio='2026-01', cuentas=['4135'])
        codigos = {f['codigo'] for f in r['filas']}
        self.assertEqual(codigos, {'413501', '41350101'})  # 4136 y 4135 fuera
        self.assertEqual(r['total_ingresos_periodo'], '150.00')
        self.assertEqual(r['superavit_periodo'], '150.00')

    def test_varias_cuentas_seleccionadas(self):
        self._mov(datetime.date(2026, 1, 5), self.ing_hijo, cre=Decimal('100'))
        self._mov(datetime.date(2026, 1, 6), self.gas, deb=Decimal('30'))
        r = comparativo_meses(inicio='2026-01', cuentas=['4135', '5110'])
        self.assertEqual(len(r['filas']), 2)
        self.assertEqual(r['total_ingresos_periodo'], '100.00')
        self.assertEqual(r['total_gastos_periodo'], '30.00')
        self.assertEqual(r['superavit_periodo'], '70.00')  # 100 - 30


class RenglonesEnCeroTest(ComparativoBase):

    def test_cuenta_sin_movimiento_se_omite(self):
        Cuenta.objects.create(codigo='4140', descripcion='Sin movimientos')
        self._mov(datetime.date(2026, 1, 5), self.ing, cre=Decimal('10'))
        r = comparativo_meses(inicio='2026-01', cuentas=['4135', '4140'])
        self.assertEqual([f['codigo'] for f in r['filas']], ['4135'])

    def test_cuenta_con_movimiento_neto_cero_se_omite(self):
        self._mov(datetime.date(2026, 1, 5), self.ing, cre=Decimal('50'))
        self._mov(datetime.date(2026, 1, 6), self.ing, deb=Decimal('50'))
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['filas'], [])
        self.assertEqual(r['superavit_periodo'], '0.00')

    def test_tercero_neto_cero_se_omite_pero_la_cuenta_no(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('50'), cedula=self.t1)
        self._mov(datetime.date(2026, 1, 6), self.gas, cre=Decimal('50'), cedula=self.t1)
        self._mov(datetime.date(2026, 1, 7), self.gas, deb=Decimal('80'), cedula=self.t2)
        r = comparativo_meses(inicio='2026-01', detalle_terceros=True)
        fila = r['filas'][0]
        self.assertEqual(fila['total'], '80.00')
        self.assertEqual([t['cedula'] for t in fila['terceros']], ['1002'])

    def test_sin_resultado_no_hay_totales_que_muestren(self):
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['filas'], [])
        self.assertEqual(r['total_ingresos'], ['0.00'] * 12)
        self.assertEqual(r['total_gastos'], ['0.00'] * 12)
        self.assertEqual(r['superavit'], ['0.00'] * 12)


class DetalleDeTercerosTest(ComparativoBase):

    def test_terceros_cuadran_con_el_renglon_de_cuenta(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'), cedula=self.t1)
        self._mov(datetime.date(2026, 2, 5), self.gas, deb=Decimal('250'), cedula=self.t2)
        self._mov(datetime.date(2026, 3, 5), self.gas, deb=Decimal('70'), cedula=self.t1)
        r = comparativo_meses(inicio='2026-01', detalle_terceros=True)
        cuenta = r['filas'][0]
        self.assertEqual([t['cedula'] for t in cuenta['terceros']], ['1001', '1002'])

        t1 = cuenta['terceros'][0]
        self.assertEqual(t1['descripcion'], 'Ana Lopez')
        self.assertEqual(t1['valores'][0], '100.00')  # Ene
        self.assertEqual(t1['valores'][1], '0.00')    # Feb
        self.assertEqual(t1['valores'][2], '70.00')   # Mar
        self.assertEqual(t1['total'], '170.00')

        for i in range(12):
            suma = sum(Decimal(t['valores'][i]) for t in cuenta['terceros'])
            self.assertEqual(suma, Decimal(cuenta['valores'][i]))

    def test_sin_detalle_no_hay_renglones_de_tercero(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'), cedula=self.t1)
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['filas'][0]['terceros'], [])

    def test_renglon_sin_tercero_cuadra_con_la_cuenta(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'), cedula=self.t1)
        self._mov(datetime.date(2026, 1, 6), self.gas, deb=Decimal('60'))
        r = comparativo_meses(inicio='2026-01', detalle_terceros=True)
        cuenta = r['filas'][0]
        codigos = [t['cedula'] for t in cuenta['terceros']]
        self.assertIn('', codigos)
        sin = next(t for t in cuenta['terceros'] if t['cedula'] == '')
        self.assertEqual(sin['descripcion'], 'Sin tercero')
        self.assertEqual(sin['total'], '60.00')

    def test_tercero_de_ingreso_usa_signo_credito(self):
        self._mov(datetime.date(2026, 4, 5), self.ing, cre=Decimal('300'), cedula=self.t1)
        r = comparativo_meses(inicio='2026-01', detalle_terceros=True)
        cuenta = r['filas'][0]
        self.assertEqual(cuenta['naturaleza'], 'C')
        self.assertEqual(cuenta['terceros'][0]['valores'][3], '300.00')  # Abr
        self.assertEqual(cuenta['total'], cuenta['terceros'][0]['total'])


class FiltrosTest(ComparativoBase):

    def setUp(self):
        super().setUp()
        self.cc2 = CentroCosto.objects.create(codigo='02', descripcion='Satelite')
        self.comp2 = Comprobante.objects.create(codigo='CC02', descripcion='Otro')

    def test_filtro_por_centro_de_costo(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'), centro=self.cc)
        self._mov(datetime.date(2026, 1, 6), self.gas, deb=Decimal('900'), centro=self.cc2)
        r = comparativo_meses(inicio='2026-01', centros=['01'])
        self.assertEqual(r['total_gastos_periodo'], '100.00')

    def test_filtro_por_comprobante(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'), comprobante=self.comp)
        self._mov(datetime.date(2026, 1, 6), self.gas, deb=Decimal('900'), comprobante=self.comp2)
        r = comparativo_meses(inicio='2026-01', comprobantes=['CC01'])
        self.assertEqual(r['total_gastos_periodo'], '100.00')

    def test_filtro_por_cedula(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'), cedula=self.t1)
        self._mov(datetime.date(2026, 1, 6), self.gas, deb=Decimal('900'), cedula=self.t2)
        r = comparativo_meses(inicio='2026-01', cedulas=['1002'])
        self.assertEqual(r['total_gastos_periodo'], '900.00')

    def test_filtro_combinado(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'),
                  cedula=self.t1, centro=self.cc, comprobante=self.comp)
        self._mov(datetime.date(2026, 1, 6), self.gas, deb=Decimal('900'),
                  cedula=self.t1, centro=self.cc, comprobante=self.comp2)
        r = comparativo_meses(inicio='2026-01', centros=['01'], comprobantes=['CC01'], cedulas=['1001'])
        self.assertEqual(r['total_gastos_periodo'], '100.00')

    def test_movimiento_fuera_de_la_ventana_se_excluye(self):
        self._mov(datetime.date(2025, 12, 31), self.gas, deb=Decimal('500'))
        self._mov(datetime.date(2027, 1, 1), self.gas, deb=Decimal('500'))
        self._mov(datetime.date(2026, 6, 15), self.gas, deb=Decimal('10'))
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['total_gastos_periodo'], '10.00')

    def test_movimiento_eliminado_se_excluye(self):
        m = self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'))
        m.deleted = True
        m.save(update_fields=['deleted'])
        r = comparativo_meses(inicio='2026-01')
        self.assertEqual(r['filas'], [])


class AlcancePorRolTest(ComparativoBase):
    """`solo_*` restringe los datos visibles según el alcance del rol."""

    def setUp(self):
        super().setUp()
        from apps.users.models import Role, User
        self.rol = Role.objects.create(NameRole='Contador')
        self.usuario = User.objects.create_user(
            login='contador', email='contador@erp.local', password='Test2025*',
            role=self.rol)
        self.client.force_authenticate(self.usuario)

    def test_restringe_cuentas_del_alcance(self):
        Cuenta.objects.create(codigo='4140', descripcion='No permitida')
        self.rol.cuentas.add(self.gas)
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'))
        self._mov(datetime.date(2026, 1, 6), self.ing, cre=Decimal('900'))
        r = self.client.get(self.url, {'inicio': '2026-01'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual([f['codigo'] for f in r.data['filas']], ['5110'])
        self.assertEqual(r.data['total_ingresos_periodo'], '0.00')   # 4135 fuera del alcance
        self.assertEqual(r.data['total_gastos_periodo'], '100.00')
        self.assertEqual(r.data['superavit_periodo'], '-100.00')

    def test_el_alcance_de_cuenta_incluye_descendientes(self):
        hijo = Cuenta.objects.create(codigo='511001', descripcion='Sueldo明細')
        self.rol.cuentas.add(self.gas)
        self._mov(datetime.date(2026, 1, 5), hijo, deb=Decimal('100'))
        r = self.client.get(self.url, {'inicio': '2026-01'})
        self.assertEqual([f['codigo'] for f in r.data['filas']], ['511001'])

    def test_sin_seleccion_en_el_rol_no_hay_restriccion(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'))
        self._mov(datetime.date(2026, 1, 6), self.ing, cre=Decimal('900'))
        r = self.client.get(self.url, {'inicio': '2026-01'})
        self.assertEqual(len(r.data['filas']), 2)


class ApiTest(ComparativoBase):

    def test_respuesta_trae_los_doce_meses_y_el_pie(self):
        self._mov(datetime.date(2026, 1, 5), self.ing, cre=Decimal('100'))
        self._mov(datetime.date(2026, 12, 5), self.ing, cre=Decimal('200'))
        r = self.client.get(self.url, {'inicio': '2026-01'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['etiquetas']), 12)
        self.assertEqual(len(r.data['total_ingresos']), 12)
        self.assertEqual(len(r.data['total_gastos']), 12)
        self.assertEqual(len(r.data['superavit']), 12)
        self.assertEqual(r.data['filas'][0]['total'], '300.00')
        self.assertEqual(r.data['total_ingresos_periodo'], '300.00')
        self.assertEqual(r.data['total_gastos_periodo'], '0.00')
        self.assertEqual(r.data['superavit_periodo'], '300.00')

    def test_el_pie_reporta_deficit(self):
        self._mov(datetime.date(2026, 3, 5), self.ing, cre=Decimal('100'))
        self._mov(datetime.date(2026, 3, 6), self.gas, deb=Decimal('450'))
        r = self.client.get(self.url, {'inicio': '2026-01'})
        self.assertEqual(r.data['superavit'][2], '-350.00')   # Mar
        self.assertEqual(r.data['superavit_periodo'], '-350.00')

    def test_requiere_autenticacion(self):
        self.client.force_authenticate(user=None)
        r = self.client.get(self.url)
        self.assertIn(r.status_code, (401, 403))

    def test_parametros_multi_se_aceptan_por_coma(self):
        self._mov(datetime.date(2026, 1, 5), self.ing, cre=Decimal('100'))
        self._mov(datetime.date(2026, 1, 6), self.gas, deb=Decimal('40'))
        r = self.client.get(self.url, {'inicio': '2026-01', 'cuenta': '4135,5110'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['filas']), 2)

    def test_detalle_de_terceros_por_parametro(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'), cedula=self.t1)
        r = self.client.get(self.url, {'inicio': '2026-01', 'detalle_terceros': 'si'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['filas'][0]['terceros'][0]['cedula'], '1001')

    def test_sin_detalle_de_terceros_por_defecto(self):
        self._mov(datetime.date(2026, 1, 5), self.gas, deb=Decimal('100'), cedula=self.t1)
        r = self.client.get(self.url, {'inicio': '2026-01'})
        self.assertEqual(r.data['filas'][0]['terceros'], [])

    def test_sin_inicio_usa_el_mes_actual(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        hoy = datetime.date.today()
        self.assertEqual(r.data['inicio'], f'{hoy.year:04d}-{hoy.month:02d}')