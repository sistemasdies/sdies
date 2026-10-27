"""Tests de los endpoints de Copia de Seguridad (export/import de la BD)."""
import gzip as gzip_module
import io
import os
import tempfile
import zipfile
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.users.models import User

EXPORT_URL = '/api/reports/backup-export/'
IMPORT_URL = '/api/reports/backup-import/'
SERVICIO   = 'apps.reports.services.backup'


class _Proceso:
    def __init__(self, returncode=0, stdout=b'', stderr=b''):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _fake_run(sql=b'-- dump\n', returncode=0, error=b'', llamadas=None):
    """Simula subprocess.run: escribe el SQL cuando stdout es un archivo."""
    def ejecutar(cmd, stdout=None, stderr=None, env=None, text=False):
        if llamadas is not None:
            llamadas.append(list(cmd))
        if hasattr(stdout, 'write'):
            stdout.write(sql)
            salida = b''
        else:
            salida = sql
        return _Proceso(returncode, salida, error)
    return ejecutar


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
        patcher = patch(f'{SERVICIO}.buscar_binario', side_effect=lambda n: n)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_export_devuelve_sql_gz_descargable(self):
        sql = b'-- dump\nCREATE TABLE x (id int);\n'
        with patch(f'{SERVICIO}.subprocess.run', _fake_run(sql)):
            r = self.client.get(EXPORT_URL)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r['Content-Type'], 'application/gzip')
            self.assertIn('attachment', r['Content-Disposition'])
            self.assertIn('.sql.gz', r['Content-Disposition'])
            contenido = b''.join(r.streaming_content)
        self.assertEqual(gzip_module.decompress(contenido), sql)

    def test_export_usa_pg_dump_compatible(self):
        llamadas = []
        with patch(f'{SERVICIO}.subprocess.run',
                   _fake_run(b'-- dump\n', llamadas=llamadas)):
            r = self.client.get(EXPORT_URL)
            b''.join(r.streaming_content)
        self.assertEqual(r.status_code, 200)
        cmd = llamadas[0]
        for opcion in ('--format=plain', '--no-owner', '--no-privileges',
                       '--clean', '--if-exists', '--encoding=UTF8'):
            self.assertIn(opcion, cmd)

    def test_export_informa_error_de_pg_dump(self):
        # El caso real de producción: cliente viejo contra servidor nuevo.
        error = b'pg_dump: error: server version mismatch'
        with patch(f'{SERVICIO}.subprocess.run',
                   _fake_run(returncode=1, error=error)):
            r = self.client.get(EXPORT_URL)
        self.assertEqual(r.status_code, 500)
        self.assertIn('pg_dump falló', r.data['detail'])
        self.assertIn('server version mismatch', r.data['detail'])

    def test_export_sin_pg_dump_informa_el_error(self):
        with patch(f'{SERVICIO}.buscar_binario', return_value=None):
            r = self.client.get(EXPORT_URL)
        self.assertEqual(r.status_code, 500)
        self.assertIn('pg_dump', r.data['detail'])

    def test_export_con_media_devuelve_zip(self):
        with tempfile.TemporaryDirectory() as media:
            with open(os.path.join(media, 'foto.txt'), 'w', encoding='utf-8') as f:
                f.write('hola')
            with override_settings(MEDIA_ROOT=media):
                with patch(f'{SERVICIO}.subprocess.run', _fake_run(b'-- dump\n')):
                    r = self.client.get(EXPORT_URL, {'incluir_media': 'true'})
                    self.assertEqual(r.status_code, 200)
                    self.assertEqual(r['Content-Type'], 'application/zip')
                    contenido = b''.join(r.streaming_content)
        with zipfile.ZipFile(io.BytesIO(contenido)) as zf:
            nombres = zf.namelist()
            self.assertIn('media/foto.txt', nombres)
            self.assertTrue(any(n.endswith('.sql') for n in nombres))


class BackupImportTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')
        self.client.force_authenticate(self.admin)
        patcher = patch(f'{SERVICIO}.buscar_binario', side_effect=lambda n: n)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _subir(self, contenido, nombre):
        archivo = io.BytesIO(contenido)
        archivo.name = nombre
        return self.client.post(IMPORT_URL, {'archivo': archivo}, format='multipart')

    def test_import_valida_extension(self):
        r = self._subir(b'no soy sql', 'copia.txt')
        self.assertEqual(r.status_code, 400)
        self.assertIn('formato', str(r.data['detail']).lower())

    def test_import_restaura_sql_y_usa_on_error_stop(self):
        llamadas = []
        with patch(f'{SERVICIO}.subprocess.run',
                   _fake_run(b'', llamadas=llamadas)):
            r = self._subir(b'SELECT 1;\n', 'copia.sql')
        self.assertEqual(r.status_code, 200)
        self.assertIn('complet', str(r.data['detail']).lower())
        cmd = llamadas[0]
        self.assertIn('--single-transaction', cmd)
        self.assertIn('ON_ERROR_STOP=1', cmd)

    def test_import_restaura_sql_gz(self):
        contenido = gzip_module.compress(b'SELECT 1;\n')
        with patch(f'{SERVICIO}.subprocess.run', _fake_run(b'')):
            r = self._subir(contenido, 'copia.sql.gz')
        self.assertEqual(r.status_code, 200)

    def test_import_restaura_zip_generado_por_la_exportacion(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zf:
            zf.writestr('sdies_backup_20260101_000000.sql', 'SELECT 1;\n')
            zf.writestr('media/foto.txt', 'hola')
        with patch(f'{SERVICIO}.subprocess.run', _fake_run(b'')):
            r = self._subir(buffer.getvalue(), 'copia.zip')
        self.assertEqual(r.status_code, 200)

    def test_import_zip_sin_sql_informa_el_error(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zf:
            zf.writestr('media/foto.txt', 'hola')
        with patch(f'{SERVICIO}.subprocess.run', _fake_run(b'')):
            r = self._subir(buffer.getvalue(), 'copia.zip')
        self.assertEqual(r.status_code, 500)
        self.assertIn('.sql', r.data['detail'])

    def test_import_informa_error_de_psql(self):
        with patch(f'{SERVICIO}.subprocess.run',
                   _fake_run(returncode=3, error=b'boom')):
            r = self._subir(b'SELECT 1;\n', 'copia.sql')
        self.assertEqual(r.status_code, 500)
        self.assertIn('boom', r.data['detail'])


class BuscarBinarioTest(TestCase):

    def test_usa_la_variable_pg_bin(self):
        with tempfile.TemporaryDirectory() as carpeta:
            nombre = 'pg_dump.exe' if os.name == 'nt' else 'pg_dump'
            ruta = os.path.join(carpeta, nombre)
            with open(ruta, 'wb') as f:
                f.write(b'')
            from apps.reports.services import backup
            with patch.object(backup.shutil, 'which', return_value=None):
                with patch.dict(os.environ, {'PG_BIN': carpeta}):
                    self.assertEqual(backup.buscar_binario('pg_dump'), ruta)
