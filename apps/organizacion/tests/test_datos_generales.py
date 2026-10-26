"""Tests del singleton DatosGenerales (modelo, permisos y endpoint)."""
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounting.models import Tercero
from apps.organizacion.models import DatosGenerales, SINGLETON_ID
from apps.users.models import Permission, Role, User

URL     = '/api/datos-generales/'
URL_IMG = '/api/datos-generales/imagenes-cloudinary/'


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

    # --- imágenes (enlaces de Cloudinary) ---

    def test_guardar_y_limpiar_enlace_imagen(self):
        self.client.force_authenticate(self.superuser)
        url = 'https://res.cloudinary.com/p8xxqrm3/image/upload/v1/sdies/logos/logo.png'
        r = self.client.patch(URL, {'logoDeLaApp': url}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(DatosGenerales.get_solo().logoDeLaApp, url)

        r2 = self.client.patch(URL, {'logoDeLaApp': ''}, format='json')
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(DatosGenerales.get_solo().logoDeLaApp, '')

    def test_enlace_invalido_da_400(self):
        self.client.force_authenticate(self.superuser)
        r = self.client.patch(URL, {'FondoDeLaApp': 'no-es-url'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('FondoDeLaApp', str(r.data))

    # --- listado de imágenes de Cloudinary ---

    def test_listar_imagenes_cloudinary(self):
        self.client.force_authenticate(self.superuser)
        fake = [{'public_id': 'sdies/logos/a.png', 'url': 'https://cdn/a.png',
                 'filename': 'a.png', 'width': 10, 'height': 10}]
        with patch('apps.organizacion.views.datos_generales_views'
                   '.cloudinary_service.listar_imagenes', return_value=fake) as mock:
            r = self.client.get(URL_IMG, {'tipo': 'logos'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['imagenes']), 1)
        self.assertEqual(r.data['imagenes'][0]['url'], 'https://cdn/a.png')
        mock.assert_called_once()

    def test_listar_imagenes_tipo_invalido(self):
        self.client.force_authenticate(self.superuser)
        r = self.client.get(URL_IMG, {'tipo': 'otro'})
        self.assertEqual(r.status_code, 400)

    def test_listar_imagenes_requiere_autenticacion(self):
        r = APIClient().get(URL_IMG, {'tipo': 'logos'})
        self.assertIn(r.status_code, (401, 403))
