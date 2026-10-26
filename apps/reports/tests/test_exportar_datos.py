"""Tests de los endpoints de Exportar Datos (CSV / ZIP)."""
import csv
import io
import zipfile

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounting.models import (
    Comprobante, Cuenta, CentroCosto, Tercero,
)
from apps.membresia.import_export import CAMPOS_MEMBRESIA
from apps.membresia.models import Membresia
from apps.users.models import Permission, Role, User

BASE_URL = '/api/reports/exportar-datos/'
ENTIDADES = ['cuentas', 'terceros', 'membresias', 'centros_costo',
             'comprobantes', 'movicont', 'plantillas', 'det_plantillas']


class ExportarDatosBase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')
        self.client.force_authenticate(self.admin)

        Cuenta.objects.create(codigo='1105', descripcion='Caja')
        self.tercero = Tercero.objects.create(
            cedula='1001', tipo_persona='N', nombre1='Ana', apellido1='Lopez')
        Membresia.objects.create(tercero=self.tercero, estado='1',
                                 escolaridad='Universitaria')
        CentroCosto.objects.create(codigo='01', descripcion='Principal')
        Comprobante.objects.create(codigo='CC', descripcion='Contabilidad')


class ExportarEntidadTest(ExportarDatosBase):

    def test_cada_entidad_devuelve_csv_descargable(self):
        for entidad in ENTIDADES:
            r = self.client.get(f'{BASE_URL}{entidad}/')
            self.assertEqual(r.status_code, 200, entidad)
            self.assertIn('text/csv', r['Content-Type'], entidad)
            self.assertIn('attachment', r['Content-Disposition'], entidad)
            self.assertIn('.csv', r['Content-Disposition'], entidad)

    def test_entidad_desconocida_devuelve_404(self):
        r = self.client.get(f'{BASE_URL}no_existe/')
        self.assertEqual(r.status_code, 404)

    def test_csv_incluye_encabezado_y_bom(self):
        r = self.client.get(f'{BASE_URL}cuentas/')
        contenido = r.content.decode('utf-8')
        self.assertTrue(contenido.startswith('\ufeff'))
        primera = contenido.lstrip('\ufeff').splitlines()[0]
        self.assertEqual(primera, 'codigo,descripcion')

    def test_exporta_los_datos_existentes(self):
        r = self.client.get(f'{BASE_URL}centros_costo/')
        filas = list(csv.reader(io.StringIO(r.content.decode('utf-8').lstrip('\ufeff'))))
        self.assertEqual(filas[0], ['codigo', 'descripcion', 'responsable'])
        self.assertIn(['01', 'Principal', ''], filas[1:])

    def test_membresias_exporta_todos_los_campos(self):
        r = self.client.get(f'{BASE_URL}membresias/')
        filas = list(csv.reader(io.StringIO(r.content.decode('utf-8').lstrip('\ufeff'))))
        self.assertEqual(filas[0], CAMPOS_MEMBRESIA)
        self.assertEqual(len(filas), 2)
        self.assertEqual(filas[1][0], '1001')


class ExportarTodoTest(ExportarDatosBase):

    def test_zip_contiene_todas_las_entidades(self):
        r = self.client.get(BASE_URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r['Content-Type'], 'application/zip')
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            nombres = zf.namelist()
            self.assertEqual(len(nombres), len(ENTIDADES))
            for nombre in nombres:
                self.assertTrue(nombre.endswith('.csv'))


class ExportarPermisosTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            login='normal', email='normal@erp.local', password='Test2025*')

    def test_requiere_autenticacion(self):
        r = self.client.get(f'{BASE_URL}cuentas/')
        self.assertIn(r.status_code, (401, 403))

    def test_rechaza_usuario_sin_permiso(self):
        self.client.force_authenticate(self.user)
        r = self.client.get(f'{BASE_URL}cuentas/')
        self.assertEqual(r.status_code, 403)

    def test_permite_usuario_con_permiso(self):
        role = Role.objects.create(NameRole='Exportador')
        for act in ['acceder', 'listar']:
            perm, _ = Permission.objects.get_or_create(
                code=f'exportar.{act}',
                defaults={'name': f'Exportar Datos — {act}', 'module': 'exportar'})
            role.permissions.add(perm)
        self.user.role = role
        self.user.save()
        self.client.force_authenticate(self.user)
        r = self.client.get(f'{BASE_URL}cuentas/')
        self.assertEqual(r.status_code, 200)
