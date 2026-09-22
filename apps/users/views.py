from datetime import date
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .services import password_recovery
from .models import User, Role, Permission, UserPreference
from .serializers.auth import (UserSerializer, UserCreateSerializer,
                                RoleSerializer, PermissionSerializer,
                                ChangePasswordSerializer, UserPreferenceSerializer)



class UserViewSet(viewsets.ModelViewSet):
    queryset         = User.objects.all().order_by('login')
    pagination_class = None
    search_fields    = ['login', 'email', 'NameUser']
    module           = 'usuarios'

    def get_serializer_class(self):
        return UserCreateSerializer if self.action == 'create' else UserSerializer

    def get_permissions(self):
        if self.action in ['me', 'change_password']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

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

    @action(detail=False, methods=['get'])
    def me(self, request):
        return Response(UserSerializer(request.user).data)

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


class RoleViewSet(viewsets.ModelViewSet):
    queryset           = Role.objects.prefetch_related('permissions', 'centros_costo', 'cuentas', 'comprobantes').all()
    serializer_class   = RoleSerializer
    pagination_class   = None
    module             = 'roles'
    permission_classes = [permissions.IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
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
    permission_classes = [permissions.IsAuthenticated]

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