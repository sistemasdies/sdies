"""Tests del módulo de Congregaciones (CRUD y vínculo con accounting.Tercero)."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounting.models import Tercero
from apps.congregacion.models import Congregacion


class CongregacionApiTest(TestCase):

    def setUp(self):
        from apps.users.models import User
        self.admin = User.objects.create_superuser(
            login='tester', email='tester@erp.local', password='Test2025*')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = '/api/congregaciones/'

    def _tercero(self, cedula='1001', nombre='Pedro', apellido='Gomez'):
        return Tercero.objects.create(
            cedula=cedula, tipo_persona='N', nombre1=nombre, apellido1=apellido)

    def _err(self, r, campo):
        """El exception_handler del proyecto aplana los errores a {'detail': 'campo: msg'}."""
        self.assertEqual(r.status_code, 400)
        detail = r.data.get('detail', '') if isinstance(r.data, dict) else str(r.data)
        self.assertIn(campo, detail, msg=f'r.data={r.data}')

    # ── Crear ──────────────────────────────────────────────────────────────
    def test_crea_congregacion_minima(self):
        r = self.client.post(self.url, {'codigo': 'C001', 'nombre': 'Catedral'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['codigo'], 'C001')
        self.assertEqual(r.data['nombre'], 'Catedral')
        self.assertIsNone(r.data['pastor'])

    def test_codigo_se_normaliza_a_mayusculas(self):
        r = self.client.post(self.url, {'codigo': 'c002', 'nombre': 'Betel'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['codigo'], 'C002')

    def test_codigo_duplicado_es_rechazado(self):
        Congregacion.objects.create(codigo='C001', nombre='Catedral')
        r = self.client.post(self.url, {'codigo': 'C001', 'nombre': 'Otra'}, format='json')
        self._err(r, 'codigo')

    def test_codigo_no_puede_superar_4_caracteres(self):
        r = self.client.post(self.url, {'codigo': 'ABCDE', 'nombre': 'Catedral'}, format='json')
        self._err(r, 'codigo')

    def test_nombre_no_puede_superar_12_caracteres(self):
        r = self.client.post(self.url, {'codigo': 'C003', 'nombre': 'Iglesia del Senor'}, format='json')
        self._err(r, 'nombre')

    def test_direccion_acepta_hasta_40_caracteres(self):
        d40 = 'x' * 40
        self.assertEqual(len(d40), 40)
        r = self.client.post(self.url, {'codigo': 'C006', 'nombre': 'Catedral', 'direccion': d40}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['direccion'], d40)

    def test_direccion_no_puede_superar_40_caracteres(self):
        r = self.client.post(self.url,
                             {'codigo': 'C007', 'nombre': 'Catedral', 'direccion': 'x' * 41},
                             format='json')
        self._err(r, 'direccion')

    def test_direccion_es_opcional(self):
        r = self.client.post(self.url, {'codigo': 'C008', 'nombre': 'Catedral'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['direccion'], '')


    def test_nombre_y_codigo_son_obligatorios(self):
        # El exception_handler del proyecto solo devuelve el primer error de campo,
        # por eso se valida cada campo por separado.
        self._err(self.client.post(self.url, {}, format='json'), 'codigo')
        self._err(self.client.post(self.url, {'codigo': 'C009'}, format='json'), 'nombre')
        self._err(self.client.post(self.url, {'nombre': 'Betel'}, format='json'), 'codigo')

    def test_pastor_es_opcional_pero_se_puede_asignar(self):
        self._tercero(cedula='1001', nombre='Pedro', apellido='Gomez')
        r = self.client.post(self.url,
                             {'codigo': 'C004', 'nombre': 'Catedral', 'pastor': '1001'},
                             format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['pastor'], '1001')
        self.assertEqual(r.data['pastor_nombre'], 'Pedro Gomez')

    def test_pastor_inexistente_es_rechazado(self):
        r = self.client.post(self.url,
                             {'codigo': 'C005', 'nombre': 'Catedral', 'pastor': '99999999'},
                             format='json')
        self._err(r, 'pastor')

    # ── Listar / leer ──────────────────────────────────────────────────────
    def test_listar_paginado(self):
        for i in range(1, 4):
            Congregacion.objects.create(codigo=f'C00{i}', nombre=f'Con{i}')
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 3)
        self.assertIn('results', r.data)

    def test_ordena_por_codigo(self):
        Congregacion.objects.create(codigo='C003', nombre='Tres')
        Congregacion.objects.create(codigo='C001', nombre='Uno')
        r = self.client.get(self.url)
        self.assertEqual([x['codigo'] for x in r.data['results']], ['C001', 'C003'])

    def test_busqueda_por_nombre(self):
        Congregacion.objects.create(codigo='C001', nombre='Catedral')
        Congregacion.objects.create(codigo='C002', nombre='Betel')
        r = self.client.get(self.url, {'search': 'catedral'})
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(r.data['results'][0]['codigo'], 'C001')

    def test_busqueda_por_nombre_del_pastor(self):
        self._tercero(cedula='1001', nombre='Pedro', apellido='Gomez')
        Congregacion.objects.create(codigo='C001', nombre='Catedral', pastor_id='1001')
        Congregacion.objects.create(codigo='C002', nombre='Betel')
        r = self.client.get(self.url, {'search': 'Gomez'})
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(r.data['results'][0]['codigo'], 'C001')

    def test_filtrar_por_pastor(self):
        self._tercero(cedula='1001')
        Congregacion.objects.create(codigo='C001', nombre='Catedral', pastor_id='1001')
        Congregacion.objects.create(codigo='C002', nombre='Betel')
        r = self.client.get(self.url, {'pastor': '1001'})
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(r.data['results'][0]['codigo'], 'C001')

    # ── Editar ─────────────────────────────────────────────────────────────
    def test_editar_congregacion(self):
        c = Congregacion.objects.create(codigo='C001', nombre='Catedral')
        r = self.client.patch(f'{self.url}{c.id}/', {'nombre': 'Catedral 2'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['nombre'], 'Catedral 2')
        self.assertEqual(Congregacion.objects.get(pk=c.pk).nombre, 'Catedral 2')

    def test_editar_permite_cambiar_pastor_a_otro_tercero(self):
        self._tercero(cedula='1001')
        self._tercero(cedula='1002', nombre='Luis', apellido='Perez')
        c = Congregacion.objects.create(codigo='C001', nombre='Catedral', pastor_id='1001')
        r = self.client.patch(f'{self.url}{c.id}/', {'pastor': '1002'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['pastor_nombre'], 'Luis Perez')

    def test_editar_no_puede_duplicar_codigo_de_otra(self):
        Congregacion.objects.create(codigo='C001', nombre='Uno')
        c2 = Congregacion.objects.create(codigo='C002', nombre='Dos')
        r = self.client.patch(f'{self.url}{c2.id}/', {'codigo': 'C001'}, format='json')
        self._err(r, 'codigo')

    def test_editar_conserva_su_propio_codigo(self):
        c = Congregacion.objects.create(codigo='C001', nombre='Uno')
        r = self.client.patch(f'{self.url}{c.id}/', {'codigo': 'C001', 'nombre': 'Otro'}, format='json')
        self.assertEqual(r.status_code, 200)

    # ── Eliminar ───────────────────────────────────────────────────────────
    def test_borrado_logico_no_borra_de_la_base(self):
        c = Congregacion.objects.create(codigo='C001', nombre='Catedral')
        r = self.client.delete(f'{self.url}{c.id}/')
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Congregacion.objects.filter(pk=c.pk).exists())
        self.assertTrue(Congregacion.all_objects.filter(pk=c.pk).exists())
        self.assertTrue(Congregacion.all_objects.get(pk=c.pk).deleted)

    def test_registro_borrado_no_aparece_en_el_listado(self):
        c = Congregacion.objects.create(codigo='C001', nombre='Catedral')
        self.client.delete(f'{self.url}{c.id}/')
        self.assertEqual(self.client.get(self.url).data['count'], 0)

    def test_codigo_de_registro_borrado_sigue_ocupado(self):
        c = Congregacion.objects.create(codigo='C001', nombre='Catedral')
        self.client.delete(f'{self.url}{c.id}/')
        r = self.client.post(self.url, {'codigo': 'C001', 'nombre': 'Reuso'}, format='json')
        self._err(r, 'codigo')

    # ── Permisos ───────────────────────────────────────────────────────────
    def test_requiere_autenticacion(self):
        anon = APIClient()
        self.assertEqual(anon.get(self.url).status_code, 401)
