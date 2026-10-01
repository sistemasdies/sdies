"""Tests del módulo de membresías y su sincronización con accounting.Tercero."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounting.models import Tercero
from apps.membresia.models import Membresia


class MembresiaApiTest(TestCase):

    def setUp(self):
        from apps.users.models import User
        self.admin = User.objects.create_superuser(
            login='tester', email='tester@erp.local', password='Test2025*')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = '/api/membresias/'

    # ── Creación y sincronización con Terceros ────────────────────────────
    def test_crea_tercero_cuando_cedula_no_existe(self):
        r = self.client.post(self.url, {
            'tercero': {'cedula': '99999999', 'nombre1': 'Juan', 'apellido1': 'Perez'},
            'estado': '1', 'personas_a_cargo': 3,
        }, format='json')
        self.assertEqual(r.status_code, 201)
        tercero = Tercero.all_objects.get(cedula='99999999')
        self.assertEqual(tercero.tipo_persona, 'N')
        self.assertEqual(tercero.nombre_completo, 'Juan Perez')
        self.assertEqual(r.data['nombre_completo'], 'Juan Perez')
        self.assertEqual(r.data['tercero']['nombre_completo'], 'Juan Perez')

    def test_reutiliza_tercero_existente_sin_crear_otro(self):
        Tercero.objects.create(cedula='12345678', tipo_persona='N',
                               nombre1='Maria', apellido1='Lopez')
        r = self.client.post(self.url, {
            'tercero': {'cedula': '12345678'}, 'estado': '1',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Tercero.all_objects.filter(cedula='12345678').count(), 1)
        self.assertEqual(Tercero.all_objects.get(cedula='12345678').nombre1, 'Maria')

    def test_cédula_duplicada_es_rechazada(self):
        self.client.post(self.url, {
            'tercero': {'cedula': '99999999', 'nombre1': 'Juan'}, 'estado': '1',
        }, format='json')
        r = self.client.post(self.url, {
            'tercero': {'cedula': '99999999', 'nombre1': 'Otro'}, 'estado': '1',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('cedula', str(r.data))

    def test_cedula_obligatoria(self):
        r = self.client.post(self.url, {'tercero': {}, 'estado': '1'}, format='json')
        self.assertEqual(r.status_code, 400)

    # ── Edición ───────────────────────────────────────────────────────────
    def _crear(self, **kwargs):
        payload = {'tercero': {'cedula': '99999999', 'nombre1': 'Juan',
                               'apellido1': 'Perez'}, 'estado': '1'}
        payload.update(kwargs)
        r = self.client.post(self.url, payload, format='json')
        self.assertEqual(r.status_code, 201)
        return r.data['id']

    def test_editar_actualiza_tercero_y_membresia(self):
        mid = self._crear()
        r = self.client.put(f'{self.url}{mid}/', {
            'tercero': {'cedula': '99999999', 'nombre1': 'Juan Carlos', 'apellido1': 'Perez'},
            'estado': '4', 'personas_a_cargo': 5,
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Tercero.all_objects.get(cedula='99999999').nombre1, 'Juan Carlos')
        self.assertEqual(Membresia.objects.get(pk=mid).estado, '4')

    def test_cedula_no_se_puede_modificar(self):
        mid = self._crear()
        r = self.client.put(f'{self.url}{mid}/', {
            'tercero': {'cedula': '88888888'}, 'estado': '1',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Tercero.all_objects.filter(cedula='88888888').exists())

    def test_editar_reutiliza_tercero_borrado_logicamente(self):
        mid = self._crear()
        tercero = Tercero.all_objects.get(cedula='99999999')
        tercero.soft_delete()
        r = self.client.put(f'{self.url}{mid}/', {
            'tercero': {'cedula': '99999999', 'nombre1': 'Restaurado'}, 'estado': '1',
        }, format='json')
        self.assertEqual(r.status_code, 200)
        tercero.refresh_from_db()
        self.assertFalse(tercero.deleted)
        self.assertEqual(tercero.nombre1, 'Restaurado')

    # ── Listado, búsqueda y filtros ───────────────────────────────────────
    def test_listar_paginado(self):
        self._crear()
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(len(r.data['results']), 1)

    def test_busqueda_por_nombre(self):
        self._crear()
        self.assertEqual(self.client.get(f'{self.url}?search=Perez').data['count'], 1)
        self.assertEqual(self.client.get(f'{self.url}?search=Nada').data['count'], 0)

    def test_filtros(self):
        self._crear(sw_bautizado=True, estado='1')
        self.assertEqual(self.client.get(f'{self.url}?estado=1').data['count'], 1)
        self.assertEqual(self.client.get(f'{self.url}?solo_bautizados=1').data['count'], 1)
        self.assertEqual(self.client.get(f'{self.url}?solo_promesados=1').data['count'], 0)

    def test_borrado_logico(self):
        mid = self._crear()
        r = self.client.delete(f'{self.url}{mid}/')
        self.assertEqual(r.status_code, 204)
        self.assertEqual(Membresia.objects.count(), 0)
        self.assertEqual(Membresia.all_objects.count(), 1)
        # El tercero NO se borra: solo desaparece la membresía
        self.assertTrue(Tercero.all_objects.filter(cedula='99999999').exists())

    # ── Acción de consulta de tercero ─────────────────────────────────────
    def test_tercero_por_cedula(self):
        Tercero.objects.create(cedula='12345678', tipo_persona='N', nombre1='Maria')
        r = self.client.get(f'{self.url}tercero-por-cedula/?cedula=12345678')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['existe'])
        self.assertFalse(r.data['ya_tiene_membresia'])
        self.assertEqual(r.data['tercero']['nombre_completo'], 'Maria')

        r = self.client.get(f'{self.url}tercero-por-cedula/?cedula=77777777')
        self.assertFalse(r.data['existe'])
        self.assertIsNone(r.data['tercero'])

    def test_tercero_por_cedula_detecta_membresia_existente(self):
        self._crear()
        r = self.client.get(f'{self.url}tercero-por-cedula/?cedula=99999999')
        self.assertTrue(r.data['ya_tiene_membresia'])
        self.assertFalse(r.data['membresia_dada_de_baja'])

    def test_tercero_por_cedula_detecta_membresia_dada_de_baja(self):
        mid = self._crear()
        self.client.delete(f'{self.url}{mid}/')
        r = self.client.get(f'{self.url}tercero-por-cedula/?cedula=99999999')
        self.assertFalse(r.data['ya_tiene_membresia'])
        self.assertTrue(r.data['membresia_dada_de_baja'])

    def test_no_se_puede_recrear_una_membresia_dada_de_baja(self):
        mid = self._crear()
        self.client.delete(f'{self.url}{mid}/')
        r = self.client.post(self.url, {
            'tercero': {'cedula': '99999999', 'nombre1': 'Juan'}, 'estado': '1',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Membresia.all_objects.filter(tercero_id='99999999').count(), 1)

    def test_tercero_por_cedula_sin_parametro(self):
        r = self.client.get(f'{self.url}tercero-por-cedula/')
        self.assertEqual(r.status_code, 400)

    # ── Buscador de terceros ──────────────────────────────────────────────
    def test_cedulas_con_membresia(self):
        self._crear()  # cédula 99999999
        r = self.client.get(f'{self.url}cedulas-con-membresia/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, ['99999999'])

    def test_cedulas_con_membresia_ignora_las_dadas_de_baja(self):
        mid = self._crear()
        Membresia.objects.get(pk=mid).soft_delete()
        r = self.client.get(f'{self.url}cedulas-con-membresia/')
        self.assertEqual(r.data, [])

    def test_la_lupa_usa_el_buscador_de_terceros(self):
        """El selector de la lupa consulta /terceros/ con ?search=, igual que TercerosPage."""
        Tercero.objects.create(cedula='1001', tipo_persona='N', nombre1='Didier', apellido1='Escobar')
        Tercero.objects.create(cedula='1002', tipo_persona='N', nombre1='Maria', apellido1='Lopez')
        r = self.client.get('/api/terceros/', {'search': 'escobar'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(r.data['results'][0]['cedula'], '1001')
        self.assertIn('nombre_completo', r.data['results'][0])
        r = self.client.get('/api/terceros/', {'search': 'lopez'})
        self.assertEqual(r.data['results'][0]['cedula'], '1002')

    def test_la_lupa_busca_por_cedula(self):
        Tercero.objects.create(cedula='1001', tipo_persona='N', nombre1='Didier', apellido1='Escobar')
        r = self.client.get('/api/terceros/', {'search': '1001'})
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(r.data['results'][0]['cedula'], '1001')

    def test_cedulas_con_membresia_no_arrastra_datos_de_terceros(self):
        self._crear()
        r = self.client.get(f'{self.url}cedulas-con-membresia/')
        self.assertIsInstance(r.data, list)
        self.assertTrue(all(isinstance(c, str) for c in r.data))

    # ── Congregación (FK a congregacion.Congregacion) ──────────────────────
    def test_crea_sin_congregacion(self):
        r = self.client.post(self.url, {
            'tercero': {'cedula': '90000001', 'nombre1': 'Sin', 'apellido1': 'Cong'},
        }, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertIsNone(r.data['congregacion'])
        self.assertEqual(r.data['congregacion_nombre'], '')

    def test_asigna_congregacion_por_codigo(self):
        from apps.congregacion.models import Congregacion
        Congregacion.objects.create(codigo='C001', nombre='Catedral')
        r = self.client.post(self.url, {
            'tercero': {'cedula': '90000002', 'nombre1': 'Con', 'apellido1': 'Cong'},
            'congregacion': 'C001',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['congregacion'], 'C001')
        self.assertEqual(r.data['congregacion_nombre'], 'Catedral')

    def test_congregacion_inexistente_es_rechazada(self):
        r = self.client.post(self.url, {
            'tercero': {'cedula': '90000003', 'nombre1': 'Mal', 'apellido1': 'Cong'},
            'congregacion': 'ZZZZ',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('congregacion', str(r.data.get('detail', r.data)))

    def test_cambia_congregacion_ya_asignada(self):
        from apps.congregacion.models import Congregacion
        Congregacion.objects.create(codigo='C001', nombre='Catedral')
        Congregacion.objects.create(codigo='C002', nombre='Betel')
        r = self.client.post(self.url, {
            'tercero': {'cedula': '90000004', 'nombre1': 'Cambio', 'apellido1': 'Cong'},
            'congregacion': 'C001',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        m = Membresia.objects.get(pk=r.data['id'])
        r = self.client.patch(f'{self.url}{m.id}/', {'congregacion': 'C002'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['congregacion'], 'C002')
        self.assertEqual(r.data['congregacion_nombre'], 'Betel')

    def test_quita_congregacion_con_null(self):
        from apps.congregacion.models import Congregacion
        Congregacion.objects.create(codigo='C001', nombre='Catedral')
        r = self.client.post(self.url, {
            'tercero': {'cedula': '90000005', 'nombre1': 'Quita', 'apellido1': 'Cong'},
            'congregacion': 'C001',
        }, format='json')
        m = Membresia.objects.get(pk=r.data['id'])
        r = self.client.patch(f'{self.url}{m.id}/', {'congregacion': None}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data['congregacion'])
        self.assertEqual(r.data['congregacion_nombre'], '')

    def test_borrar_congregacion_no_rompe_la_membresia(self):
        from apps.congregacion.models import Congregacion
        c = Congregacion.objects.create(codigo='C001', nombre='Catedral')
        r = self.client.post(self.url, {
            'tercero': {'cedula': '90000006', 'nombre1': 'Huerfana', 'apellido1': 'Cong'},
            'congregacion': 'C001',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        m = Membresia.objects.get(pk=r.data['id'])
        c.delete()  # borrado lógico: la FK queda en null, no se rompe
        m.refresh_from_db()
        self.assertIsNone(m.congregacion_id)

    def test_filtrar_por_congregacion(self):
        from apps.congregacion.models import Congregacion
        Congregacion.objects.create(codigo='C001', nombre='Catedral')
        Congregacion.objects.create(codigo='C002', nombre='Betel')
        self.client.post(self.url, {
            'tercero': {'cedula': '90000007', 'nombre1': 'En', 'apellido1': 'Catedral'},
            'congregacion': 'C001'}, format='json')
        self.client.post(self.url, {
            'tercero': {'cedula': '90000008', 'nombre1': 'En', 'apellido1': 'Betel'},
            'congregacion': 'C002'}, format='json')
        r = self.client.get(self.url, {'congregacion': 'C001'})
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(r.data['results'][0]['congregacion'], 'C001')

    def test_buscar_por_nombre_de_congregacion(self):
        from apps.congregacion.models import Congregacion
        Congregacion.objects.create(codigo='C001', nombre='Catedral')
        self.client.post(self.url, {
            'tercero': {'cedula': '90000009', 'nombre1': 'Buscador', 'apellido1': 'Uno'},
            'congregacion': 'C001'}, format='json')
        self.client.post(self.url, {
            'tercero': {'cedula': '90000010', 'nombre1': 'Otro', 'apellido1': 'Dos'}}, format='json')
        r = self.client.get(self.url, {'search': 'Catedral'})
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(r.data['results'][0]['congregacion'], 'C001')

    # ── Aislamiento de estado ─────────────────────────────────────────────
    def test_estado_no_sincroniza_con_terceros(self):
        mid = self._crear(estado='6')
        self.assertEqual(Membresia.objects.get(pk=mid).estado, '6')
        self.assertTrue(Tercero.all_objects.get(cedula='99999999').is_active)
