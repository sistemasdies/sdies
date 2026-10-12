"""Tests del singleton DatosGenerales (modelo, permisos y endpoint)."""
import io
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.accounting.models import Tercero
from apps.organizacion.models import DatosGenerales, SINGLETON_ID
from apps.users.models import Permission, Role, User

URL = '/api/datos-generales/'


def _png(nombre='logo.png'):
    buf = io.BytesIO()
    Image.new('RGB', (4, 4), 'red').save(buf, format='PNG')
    buf.seek(0)
    return SimpleUploadedFile(nombre, buf.read(), content_type='image/png')


def _usuario(login, codes=()):
    role = Role.objects.create(NameRole=f'Rol-{login}')
    for code in codes:
        mod = code.split('.')[0]
        perm, _ = Permission.objects.get_or_create(
            code=code, defaults={'name': code, 'module': mod})
        role.permissions.add(perm)
    user = User.objects.create_user(login=login, email=f'{login}@erp.local',
                                    password='Test2025*')
    user.role = role
    user.save()
    return user


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix='org-media-'))
class DatosGeneralesTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*')

    # --- modelo ---

    def test_get_solo_crea_y_reutiliza_una_sola_fila(self):
        a = DatosGenerales.get_solo()
        b = DatosGenerales.get_solo()
        self.assertEqual(a.pk, SINGLETON_ID)
        self.assertEqual(a.pk, b.pk)
        self.assertEqual(DatosGenerales.all_objects.count(), 1)

    # --- lectura abierta a cualquier autenticado ---

    def test_get_crea_registro_y_es_abierto_a_autenticados(self):
        usuario = _usuario('normal')  # sin permisos del módulo
        self.client.force_authenticate(usuario)
        r = self.client.get(URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(DatosGenerales.all_objects.count(), 1)

    def test_get_requiere_autenticacion(self):
        r = APIClient().get(URL)
        self.assertIn(r.status_code, (401, 403))

    # --- edición requiere permiso ---

    def test_patch_sin_permiso_da_403(self):
        usuario = _usuario('sinperm')
        self.client.force_authenticate(usuario)
        r = self.client.patch(URL, {'NombreOrganizacion': 'X'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_patch_con_permiso_actualiza(self):
        usuario = _usuario('editor', ['datos_generales.editar'])
        self.client.force_authenticate(usuario)
        r = self.client.patch(URL, {
            'NombreOrganizacion': 'Iglesia Central',
            'NIT': '900123456',
            'ciudad': 'Bogotá',
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['NombreOrganizacion'], 'Iglesia Central')
        solo = DatosGenerales.get_solo()
        self.assertEqual(solo.NombreOrganizacion, 'Iglesia Central')
        self.assertEqual(solo.NIT, '900123456')

    def test_varios_patch_no_crean_duplicados(self):
        self.client.force_authenticate(self.superuser)
        self.client.patch(URL, {'NombreOrganizacion': 'A'}, format='json')
        self.client.patch(URL, {'NombreOrganizacion': 'B'}, format='json')
        self.assertEqual(DatosGenerales.all_objects.count(), 1)

    # --- presidente ---

    def test_presidente_por_cedula_y_nombre(self):
        tercero = Tercero.objects.create(cedula='1001', tipo_persona='N',
                                         nombre1='Ana', apellido1='López')
        self.client.force_authenticate(self.superuser)
        r = self.client.patch(URL, {'CedulaPresidente': '1001'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['CedulaPresidente'], '1001')
        self.assertEqual(r.data['presidente_nombre'], tercero.nombre_completo)
        self.assertEqual(DatosGenerales.get_solo().CedulaPresidente_id, '1001')

    def test_presidente_cedula_inexistente_da_400(self):
        self.client.force_authenticate(self.superuser)
        r = self.client.patch(URL, {'CedulaPresidente': '9999'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('CedulaPresidente', str(r.data))

    def test_presidente_cadena_vacia_limpia(self):
        Tercero.objects.create(cedula='1001', tipo_persona='N', nombre1='Ana', apellido1='López')
        self.client.force_authenticate(self.superuser)
        self.client.patch(URL, {'CedulaPresidente': '1001'}, format='json')
        r = self.client.patch(URL, {'CedulaPresidente': ''}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data['CedulaPresidente'])
        self.assertIsNone(DatosGenerales.get_solo().CedulaPresidente_id)

    # --- imágenes (multipart) ---

    def test_subir_y_limpiar_imagen(self):
        self.client.force_authenticate(self.superuser)
        r = self.client.patch(URL, {'logoDeLaApp': _png()}, format='multipart')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(DatosGenerales.get_solo().logoDeLaApp)

        r2 = self.client.patch(URL, {'logoDeLaApp': ''}, format='multipart')
        self.assertEqual(r2.status_code, 200)
        self.assertFalse(DatosGenerales.get_solo().logoDeLaApp)
