from datetime import date
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.core.permissions import ModulePermission

from .services import password_recovery
from .services.role_context import es_administrador
from .models import User, Role, Permission, UserPreference
from .serializers.auth import (UserSerializer, UserCreateSerializer, ProfileSerializer,
                                RoleSerializer, PermissionSerializer,
                                ChangePasswordSerializer, UserPreferenceSerializer)



class UserViewSet(viewsets.ModelViewSet):
    queryset         = User.objects.all().order_by('login')
    pagination_class = None
    search_fields    = ['login', 'email', 'NameUser']
    module           = 'usuarios'

    def get_serializer_class(self):
        return UserCreateSerializer if self.action == 'create' else UserSerializer

    # Acciones propias: cualquier usuario autenticado, sin importar su rol.
    ACCIONES_PROPIAS = {'me', 'change_password', 'preferencias'}

    # Permiso por acción; si no está en el mapa se deduce del método HTTP.
    PERMISOS_ACCION = {
        'list':              'usuarios.listar',
        'retrieve':          'usuarios.listar',
        'create':            'usuarios.agregar',
        'update':            'usuarios.editar',
        'partial_update':    'usuarios.editar',
        'reset_password':    'usuarios.editar',
        'bloquear_fecha':    'usuarios.editar',
        'destroy':           'usuarios.borrar',
        'eliminar_definitivo': 'usuarios.borrar',
        'activar':           'usuarios.borrar',
    }

    def get_permissions(self):
        if self.action in self.ACCIONES_PROPIAS:
            return [permissions.IsAuthenticated()]
        self.required_permission = self.PERMISOS_ACCION.get(self.action)
        return [ModulePermission()]

    def destroy(self, request, *args, **kwargs):
        # Desactivar en lugar de borrar físicamente
        instance = self.get_object()
        if instance == request.user:
            return Response({'detail': 'No puedes desactivarte a ti mismo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        instance.is_active = False
        instance.estado    = 0
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['delete'], url_path='eliminar-definitivo')
    def eliminar_definitivo(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response({'detail': 'No puedes eliminarte a ti mismo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='activar')
    def activar(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.estado    = 1
        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user     = self.get_object()
        password = request.data.get('password', '')
        if len(password) < 8:
            return Response({'detail': 'La contraseña debe tener mínimo 8 caracteres.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save()
        return Response({'detail': f'Contraseña de {user.login} actualizada.'})

    @action(detail=False, methods=['get', 'patch'], url_path='me')
    def me(self, request):
        if request.method == 'PATCH':
            email = request.data.get('email')
            if email is not None and User.objects.exclude(pk=request.user.pk).filter(
                    email__iexact=email.strip()).exists():
                return Response({'email': ['El email ya está registrado por otro usuario.']},
                                status=status.HTTP_400_BAD_REQUEST)
            s = ProfileSerializer(request.user, data=request.data, partial=True)
            s.is_valid(raise_exception=True)
            s.save()
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=['post'], url_path='bloquear-fecha')
    def bloquear_fecha(self, request):
        """Asigna (o quita) la fecha de cierre de uno o varios usuarios.
        Body: { user_ids: [...], fecha?: 'YYYY-MM-DD' } — fecha vacía/nula = desbloquear."""
        user_ids = request.data.get('user_ids')
        if not isinstance(user_ids, list) or not user_ids:
            return Response({'detail': 'Seleccione al menos un usuario.'},
                            status=status.HTTP_400_BAD_REQUEST)
        fecha = None
        fecha_raw = request.data.get('fecha')
        if fecha_raw:
            try:
                fecha = date.fromisoformat(str(fecha_raw))
            except (TypeError, ValueError):
                return Response({'detail': 'Fecha inválida.'},
                                status=status.HTTP_400_BAD_REQUEST)
        usuarios = list(User.objects.filter(pk__in=user_ids))
        if len(usuarios) != len(set(user_ids)):
            return Response({'detail': 'Algunos usuarios no existen.'},
                            status=status.HTTP_400_BAD_REQUEST)
        for u in usuarios:
            u.fecha_cierre = fecha
            u.save(update_fields=['fecha_cierre', 'updated_at'])
        if fecha is None:
            return Response({'detail': f'Fecha de cierre quitada a {len(usuarios)} usuario(s).'})
        return Response({'detail': f'Fecha de cierre {fecha.isoformat()} asignada a {len(usuarios)} usuario(s).'})

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        s = ChangePasswordSerializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        request.user.set_password(s.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Contraseña actualizada correctamente.'})

    @action(detail=False, methods=['get', 'put'])
    def preferencias(self, request):
        """GET: devuelve {data}. PUT: funde el dict recibido sobre el existente.
        Body PUT: { "data": {...} } o el dict directamente."""
        pref, _ = UserPreference.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            return Response({'data': pref.data})
        body = request.data.get('data', request.data)
        if not isinstance(body, dict):
            return Response({'detail': 'El cuerpo debe ser un objeto.'},
                            status=status.HTTP_400_BAD_REQUEST)
        pref.data = {**pref.data, **body}
        pref.save(update_fields=['data', 'updated_at'])
        return Response({'data': pref.data})


class AsumirRolView(APIView):
    """POST {role_id}: el administrador empieza a usar temporalmente ese rol."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not es_administrador(request.user):
            return Response({'detail': 'Solo un administrador puede usar otro rol.'},
                            status=status.HTTP_403_FORBIDDEN)

        role_id = request.data.get('role_id')
        try:
            role = Role.objects.filter(pk=int(role_id)).first()
        except (TypeError, ValueError):
            role = None
        if role is None:
            return Response({'detail': 'Seleccione un rol válido.'},
                            status=status.HTTP_400_BAD_REQUEST)

        request.user.rol_efectivo = role
        return Response(UserSerializer(request.user).data)


class RetomarRolView(APIView):
    """POST: vuelve al rol real del administrador (quita el rol asumido)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # No se exige ser administrador aquí: si su rol real cambió mientras
        # estaba asumiendo otro, igual debe poder salir del estado.
        request.user.rol_efectivo = None
        return Response(UserSerializer(request.user).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset           = Role.objects.prefetch_related('permissions', 'centros_costo', 'cuentas', 'comprobantes').all()
    serializer_class   = RoleSerializer
    pagination_class   = None
    module             = 'roles'
    permission_classes = [ModulePermission]

    def _bloqueado_por_rol(self, request):
        if getattr(request.user, 'rol_efectivo', None) is not None:
            return Response({'detail': 'Retome su rol para administrar roles.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return None

    def create(self, request, *args, **kwargs):
        bloqueo = self._bloqueado_por_rol(request)
        if bloqueo:
            return bloqueo
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        bloqueo = self._bloqueado_por_rol(request)
        if bloqueo:
            return bloqueo
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        bloqueo = self._bloqueado_por_rol(request)
        if bloqueo:
            return bloqueo
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        bloqueo = self._bloqueado_por_rol(request)
        if bloqueo:
            return bloqueo
        instance = self.get_object()
        if instance.is_system:
            return Response({'detail': 'No se puede eliminar un rol del sistema.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if instance.users.exists():
            return Response({'detail': f'Rol asignado a {instance.users.count()} usuario(s).'},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = Permission.objects.all().order_by('module', 'code')
    serializer_class   = PermissionSerializer
    pagination_class   = None
    module             = 'roles'
    permission_classes = [ModulePermission]

    @action(detail=False, methods=['get'])
    def grouped(self, request):
        result = {}
        for m in Permission.objects.order_by('module', 'code'):
            result.setdefault(m.module, []).append(
                {'id': m.id, 'code': m.code, 'name': m.name})
        return Response(result)


# ── Recuperación de contraseña ──────────────────────────────────────────────

class RecuperarPaso1View(APIView):
    """Paso 1: identifica al usuario por login o correo."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        password_recovery.buscar_usuario(request.data.get('login', '').strip())
        return Response({'ok': True})


class RecuperarPaso2View(APIView):
    """Paso 2: valida la fecha de nacimiento y devuelve las opciones de frase."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        login = request.data.get('login', '').strip()
        fecha = request.data.get('fecha_nacimiento', '')
        user  = password_recovery.buscar_usuario(login)
        if not user or not password_recovery.validar_fecha_nacimiento(user, fecha):
            return Response({'detail': 'Datos incorrectos. Verifique su fecha de nacimiento.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not user.frase_verificacion:
            return Response({'detail': 'Aún no ha configurado su frase de verificación. Contacte al administrador.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({'opciones': password_recovery.opciones_frases(user), 'unico_intento': True})


class RecuperarPaso3View(APIView):
    """Paso 3: el usuario escoge su frase (una sola oportunidad); si acierta recibe un token."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        login = request.data.get('login', '').strip()
        frase = request.data.get('frase', '').strip()
        user  = password_recovery.buscar_usuario(login)
        if not user or not user.frase_verificacion:
            return Response({'detail': 'Los datos no son válidos. Vuelva a iniciar el proceso.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if frase != user.frase_verificacion:
            password_recovery.desactivar_cuenta(user)
            return Response({'detail': 'La frase no corresponde. Por seguridad, su cuenta ha sido desactivada. Contacte al administrador para reactivarla.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({'token': password_recovery.generar_token(user)})


class RecuperarPaso4View(APIView):
    """Paso 4: con el token válido, fija la nueva contraseña."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        token  = request.data.get('token', '')
        nueva  = request.data.get('nueva_clave', '')
        confirma = request.data.get('confirmar', '')
        if nueva != confirma:
            return Response({'detail': 'Las contraseñas no coinciden.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(nueva) < 8:
            return Response({'detail': 'La contraseña debe tener mínimo 8 caracteres.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user = password_recovery.consumir_token(token)
        if not user:
            return Response({'detail': 'El enlace expiró o no es válido. Vuelva a iniciar el proceso.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user.set_password(nueva)
        user.save(update_fields=['password'])
        return Response({'detail': 'Contraseña actualizada. Ya puede ingresar al sistema.'})


class ConfigurarVerificacionView(APIView):
    """Configura frase + fecha de nacimiento (obligatorio si la frase está en blanco)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        fecha = request.data.get('fecha_nacimiento', '')
        frase = request.data.get('frase', '').strip()
        frase2 = request.data.get('frase2', '').strip()
        try:
            date.fromisoformat(fecha)
        except (TypeError, ValueError):
            return Response({'detail': 'Fecha de nacimiento no válida.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not frase:
            return Response({'detail': 'La frase de verificación es obligatoria.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(frase) > 30:
            return Response({'detail': 'La frase no puede superar 30 caracteres.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if frase != frase2:
            return Response({'detail': 'Las frases no coinciden.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        user.fecha_nacimiento = date.fromisoformat(fecha)
        user.frase_verificacion = frase
        user.save(update_fields=['fecha_nacimiento', 'frase_verificacion'])
        return Response({'detail': 'Datos de verificación guardados.', 'verificacion_pendiente': False})