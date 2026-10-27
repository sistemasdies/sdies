"""Autenticación JWT con soporte para el rol asumido temporalmente.

El frontend envía el header ``X-Rol-Activo`` con el id del rol que el
administrador quiere usar. Si el usuario real es administrador y el rol existe,
se guarda en ``user.rol_efectivo`` durante la petición. El rol real del usuario
nunca se modifica ni se guarda.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Role
from .services.role_context import es_administrador

HEADER_ROL = 'HTTP_X_ROL_ACTIVO'


class RolActivoJWTAuthentication(JWTAuthentication):
    """JWTAuthentication + aplicación del rol asumido."""

    def authenticate(self, request):
        resultado = super().authenticate(request)
        if resultado is None:
            return None
        user, token = resultado
        self._aplicar_rol(request, user)
        return user, token

    def _aplicar_rol(self, request, user):
        role_id = (request.META.get(HEADER_ROL) or '').strip()
        if not role_id:
            return

        # Un usuario que no es administrador no puede asumir roles. Se ignora
        # el header para no romper la sesión ni elevar privilegios.
        if not es_administrador(user):
            request.rol_activo_invalido = (
                'Solo un administrador puede usar otro rol.'
            )
            return

        try:
            role_id = int(role_id)
        except (TypeError, ValueError):
            request.rol_activo_invalido = 'El rol indicado no es válido.'
            return

        role = Role.objects.filter(pk=role_id).first()
        if role is None:
            # Se ignora para que el administrador nunca quede encerrado si el
            # rol fue eliminado; el frontend limpiará su estado.
            request.rol_activo_invalido = 'El rol indicado ya no existe.'
            return

        user.rol_efectivo = role
        request.rol_activo = role
