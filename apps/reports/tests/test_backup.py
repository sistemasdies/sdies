"""Tests de los endpoints de Copia de Seguridad (export/import de la BD)."""
import gzip as gzip_module
import io
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User

EXPORT_URL = '/api/reports/backup-export/'
IMPORT_URL = '/api/reports/backup-import/'


def _fake_popen(stdout_bytes, returncode=0):
    """Devuelve una fabrica que simula subprocess.Popen con stdout/stderr."""
    class _Proc:
        def __init__(self, *args, **kwargs):
            self.stdout = io.BytesIO(stdout_bytes)
            self.stderr = io.BytesIO(b'')
            self.returncode = returncode
            self.args = args

        def communicate(self):
            return b'', b''

    return _Proc


class _FakeCompleted:
    def __init__(self, returncode=0, stdout='', stderr=''):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class BackupPermisosTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.normal = User.objects.create_user(
            login='normal', email='normal@erp.local', password='Test2025*')
        self.admin = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')

    def test_export_requiere_autenticacion(self):
        r = self.client.get(EXPORT_URL)
        self.assertIn(r.status_code, (401, 403))

    def test_export_rechaza_usuario_no_superusuario(self):
        self.client.force_authenticate(self.normal)
        r = self.client.get(EXPORT_URL)
        self.assertEqual(r.status_code, 403)

    def test_import_rechaza_usuario_no_superusuario(self):
        self.client.force_authenticate(self.normal)
        r = self.client.post(IMPORT_URL, {})
        self.assertEqual(r.status_code, 403)

    def test_import_requiere_archivo(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(IMPORT_URL, {})
        self.assertEqual(r.status_code, 400)
        self.assertIn('archivo', str(r.data['detail']).lower())


class BackupExportTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')
        self.client.force_authenticate(self.admin)

    def test_export_devuelve_sql_gz_descargable(self):
        sql = b'-- dump\nCREATE TABLE x (id int);\n'
        with patch('apps.reports.views.subprocess.Popen', _fake_popen(sql)):
            r = self.client.get(EXPORT_URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r['Content-Type'], 'application/gzip')
        self.assertIn('attachment', r['Content-Disposition'])
        self.assertIn('.sql.gz', r['Content-Disposition'])
        contenido = b''.join(r.streaming_content)
        self.assertEqual(gzip_module.decompress(contenido), sql)

    def test_export_con_media_devuelve_zip(self):
        sql = b'-- dump\n'
        with patch('apps.reports.views.subprocess.Popen', _fake_popen(sql)):
            r = self.client.get(EXPORT_URL, {'incluir_media': 'true'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r['Content-Type'], 'application/zip')
        self.assertIn('.zip', r['Content-Disposition'])

    def test_export_sin_pg_dump_informa_el_error(self):
        with patch('apps.reports.views.subprocess.Popen',
                   side_effect=FileNotFoundError('pg_dump')):
            r = self.client.get(EXPORT_URL)
        self.assertEqual(r.status_code, 500)
        self.assertIn('pg_dump', str(r.data['detail']))


class BackupImportTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')
        self.client.force_authenticate(self.admin)

    def test_import_valida_extension(self):
        archivo = io.BytesIO(b'no soy sql')
        archivo.name = 'copia.txt'
        r = self.client.post(IMPORT_URL, {'archivo': archivo}, format='multipart')
        self.assertEqual(r.status_code, 400)
        self.assertIn('formato', str(r.data['detail']).lower())

    def test_import_restaura_sql_gz(self):
        contenido = gzip_module.compress(b'SELECT 1;\n')
        archivo = io.BytesIO(contenido)
        archivo.name = 'copia.sql.gz'
        with patch('apps.reports.views.subprocess.run',
                   return_value=_FakeCompleted(0, 'ok', '')):
            r = self.client.post(IMPORT_URL, {'archivo': archivo}, format='multipart')
        self.assertEqual(r.status_code, 200)
        self.assertIn('complet', str(r.data['detail']).lower())

    def test_import_informa_error_de_psql(self):
        archivo = io.BytesIO(b'SELECT 1;\n')
        archivo.name = 'copia.sql'
        with patch('apps.reports.views.subprocess.run',
                   return_value=_FakeCompleted(1, '', 'boom')):
            r = self.client.post(IMPORT_URL, {'archivo': archivo}, format='multipart')
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.data['stderr'], 'boom')
