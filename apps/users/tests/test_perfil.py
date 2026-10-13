"""Tests de edición de datos propios (PATCH /api/users/me/)."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import Role, User

URL = '/api/users/me/'


class PerfilPropioTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(login='jperez', email='jperez@erp.local',
                                             password='Test2025*')
        self.client.force_authenticate(self.user)

    def test_patch_actualiza_datos_permitidos(self):
        r = self.client.patch(URL, {
            'NameUser': 'Juan Perez', 'caja_user': 'CAJA1',
            'centro_costo_user': 'CC005', 'frase_verificacion': 'Mi frase',
        })
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.NameUser, 'Juan Perez')
        self.assertEqual(self.user.caja_user, 'CAJA1')
        self.assertEqual(self.user.centro_costo_user, 'CC005')

    def test_patch_no_permite_cambiar_rol_ni_login(self):
        otro = User.objects.create_user(login='ana', email='ana@erp.local',
                                        password='Test2025*')
        r = self.client.patch(URL, {'login': 'hacker', 'role': otro.role_id,
                                    'is_staff': True}, format='json')
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.login, 'jperez')
        self.assertFalse(self.user.is_staff)

    def test_patch_email_duplicado_devuelve_error(self):
        User.objects.create_user(login='ana', email='ana@erp.local', password='Test2025*')
        r = self.client.patch(URL, {'email': 'ana@erp.local'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('email', r.data)

    def test_get_me_devuelve_el_usuario_autenticado(self):
        r = self.client.get(URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['login'], 'jperez')