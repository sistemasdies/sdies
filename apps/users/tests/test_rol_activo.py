"""Tests del rol asumido temporalmente (Usar Rol / Retomar el Rol)."""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounting.models import CentroCosto
from apps.users.models import Permission, Role, User
from apps.users.services.controls import controles_usuario
from apps.users.services.scopes import user_scope

ME_URL       = '/api/users/me/'
ASUMIR_URL   = '/api/users/asumir-rol/'
RETOMAR_URL  = '/api/users/retomar-rol/'
ROLES_URL    = '/api/users/roles/'


def crear_permiso(code):
    module, _ = code.split('.', 1)
    return Permission.objects.create(code=code, name=code, module=module)


class RolAsumidoTest(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.permisos = {
            code: crear_permiso(code)
            for code in (
                'roles.listar', 'roles.agregar', 'roles.editar', 'roles.borrar',
                'asientos.listar', 'asientos.agregar', 'usuarios.listar',
            )
        }

        self.rol_admin = Role.objects.create(NameRole='Administrador', is_system=True)
        self.rol_admin.permissions.set(self.permisos.values())

        self.rol_contador = Role.objects.create(NameRole='Contador')
        self.rol_contador.permissions.set([
            self.permisos['asientos.listar'],
            self.permisos['roles.agregar'],   # para probar el bloqueo al administrar roles
        ])
        self.rol_contador.controles = {'editar_movimiento': 'D'}
        self.rol_contador.save()

        self.admin = User.objects.create_user(
            login='admin', email='admin@erp.local', password='Test2025*',
            NameUser='Admin', role=self.rol_admin,
        )
        self.superuser = User.objects.create_superuser(
            login='root', email='root@erp.local', password='Test2025*',
            NameUser='Root',
        )
        self.contador = User.objects.create_user(
            login='contador', email='contador@erp.local', password='Test2025*',
            NameUser='Contador', role=self.rol_contador,
        )

    # ── helpers ────────────────────────────────────────────────────────────

    def autenticar(self, user, rol_asumido=None):
        token = RefreshToken.for_user(user).access_token
        credenciales = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        if rol_asumido is not None:
            credenciales['HTTP_X_ROL_ACTIVO'] = str(rol_asumido.id)
        self.client.credentials(**credenciales)

    # ── administrador por rol ──────────────────────────────────────────────

    def test_administrador_por_rol_puede_asumir_y_retomar(self):
        self.autenticar(self.admin)

        r = self.client.post(ASUMIR_URL, {'role_id': self.rol_contador.id}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['rol_activo']['nombre'], 'Contador')
        self.assertFalse(r.data['is_superuser'])
        self.assertFalse(r.data['is_staff'])
        self.assertTrue(r.data['puede_asumir_roles'])
        self.assertIn('asientos.listar', r.data['permission_codes'])
        self.assertNotIn('roles.listar', r.data['permission_codes'])
        self.assertEqual(r.data['controles']['editar_movimiento'], 'D')

        # El header mantiene el rol en las siguientes peticiones.
        self.autenticar(self.admin, self.rol_contador)
        r = self.client.get(ME_URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['rol_activo']['id'], self.rol_contador.id)
        self.assertFalse(r.data['is_superuser'])

        # Sin roles.listar, no puede consultar la administración de roles.
        r = self.client.get(ROLES_URL)
        self.assertEqual(r.status_code, 403)

        # Retomar vuelve al rol real.
        r = self.client.post(RETOMAR_URL, {}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data['rol_activo'])
        self.assertIn('roles.listar', r.data['permission_codes'])

    def test_superusuario_tambien_pierde_el_bypass(self):
        self.autenticar(self.superuser, self.rol_contador)

        r = self.client.get(ME_URL)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['is_superuser'])
        self.assertFalse(r.data['is_staff'])
        self.assertEqual(r.data['rol_activo']['nombre'], 'Contador')

        r = self.client.get(ROLES_URL)
        self.assertEqual(r.status_code, 403)

    # ── restricciones ──────────────────────────────────────────────────────

    def test_usuario_no_administrador_no_puede_asumir(self):
        self.autenticar(self.contador)

        r = self.client.post(ASUMIR_URL, {'role_id': self.rol_admin.id}, format='json')
        self.assertEqual(r.status_code, 403)

        # Aunque envíe el header, se ignora.
        self.autenticar(self.contador, self.rol_admin)
        r = self.client.get(ME_URL)
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data['rol_activo'])
        self.assertIn('asientos.listar', r.data['permission_codes'])

    def test_rol_inexistente_se_ignora(self):
        token = RefreshToken.for_user(self.admin).access_token
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {token}',
            HTTP_X_ROL_ACTIVO='999999',
        )
        r = self.client.get(ME_URL)
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data['rol_activo'])
        self.assertIn('roles.listar', r.data['permission_codes'])

    def test_no_se_pueden_administrar_roles_mientras_se_usa_otro(self):
        self.autenticar(self.admin, self.rol_contador)

        r = self.client.post(ROLES_URL, {
            'NameRole': 'Nuevo',
            'description': '',
            'permission_ids': [],
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Retome su rol', r.data['detail'])

    def test_permisos_de_usuarios_siguen_el_rol_asumido(self):
        self.autenticar(self.admin)
        self.assertEqual(self.client.get('/api/users/').status_code, 200)

        self.autenticar(self.admin, self.rol_contador)  # sin usuarios.listar
        self.assertEqual(self.client.get('/api/users/').status_code, 403)

    def test_acciones_propias_siguen_disponibles_sin_permisos(self):
        self.autenticar(self.contador)
        self.assertEqual(self.client.get(ME_URL).status_code, 200)
        self.assertEqual(self.client.get('/api/users/preferencias/').status_code, 200)

    # ── alcance y controles ────────────────────────────────────────────────

    def test_scope_del_rol_asumido(self):
        centro = CentroCosto.objects.create(codigo='CC001', descripcion='Centro 1')
        self.rol_contador.centros_costo.add(centro)

        self.admin.rol_efectivo = self.rol_contador
        scope = user_scope(self.admin)
        self.assertEqual(scope['centros_costo'], {'CC001'})
        self.assertIsNone(scope['cuentas'])

    def test_controles_del_rol_asumido(self):
        self.admin.rol_efectivo = self.rol_contador
        self.assertEqual(controles_usuario(self.admin)['editar_movimiento'], 'D')

        self.admin.rol_efectivo = None
        self.assertEqual(controles_usuario(self.admin)['editar_movimiento'], 'P')
