"""Recuperación de contraseña mediante fecha de nacimiento + frase de verificación.

Flujo:
1. El usuario indica su login/correo.
2. El sistema pregunta su fecha de nacimiento.
3. Si coincide, se muestran varias frases (la suya mezclada con otras) y debe escoger.
4. El usuario tiene UNA sola oportunidad: si falla, su cuenta se desactiva y el administrador debe intervenir.
5. Si acierta, se le permite fijar una nueva contraseña mediante un token de un solo uso.
"""
import random
import secrets
from datetime import date
from django.utils import timezone
from django.db.models import Q
from apps.users.models import User


RESET_TOKEN_MINUTOS = 15

FRASES_RESERVA = [
    'Camino verdadero',
    'Luna nueva de diciembre',
    'Sol de la mañana',
    'Río tranquilo de otoño',
    'Colina verde y alta',
    'Estrella del alba',
    'Viento suave de la costa',
    'Jardín secreto de casa',
    'Nube blanca del mediodía',
    'Canción de la montaña',
]


def buscar_usuario(login_o_email):
    q = Q(login__iexact=login_o_email) | Q(email__iexact=login_o_email)
    return User.objects.filter(q, is_active=True).first()


def validar_fecha_nacimiento(user, texto):
    if not user.fecha_nacimiento:
        return False
    try:
        return user.fecha_nacimiento == date.fromisoformat(texto)
    except (TypeError, ValueError):
        return False


def opciones_frases(user):
    """Devuelve 3 opciones distintas: la frase del usuario + 2 señuelos, mezcladas."""
    real = user.frase_verificacion
    candidatas = set(
        User.objects.exclude(pk=user.pk)
                    .exclude(frase_verificacion='')
                    .values_list('frase_verificacion', flat=True)
    )
    candidatas.update(f for f in FRASES_RESERVA if f != real)
    candidatas.discard(real)
    señuelos = random.sample(sorted(candidatas), min(2, len(candidatas)))
    for f in FRASES_RESERVA:
        if len(señuelos) >= 2:
            break
        if f != real and f not in señuelos:
            señuelos.append(f)
    opciones = [real] + señuelos[:2]
    random.shuffle(opciones)
    return [{'id': i, 'frase': f} for i, f in enumerate(opciones)]


def generar_token(user):
    user.reset_token = secrets.token_urlsafe(32)
    user.reset_token_expira = timezone.now() + timezone.timedelta(minutes=RESET_TOKEN_MINUTOS)
    user.save(update_fields=['reset_token', 'reset_token_expira'])
    return user.reset_token


def desactivar_cuenta(user):
    """Desactiva la cuenta por fallar la frase de verificación (un solo intento)."""
    user.is_active = False
    user.estado    = 0
    user.reset_token = ''
    user.reset_token_expira = None
    user.save(update_fields=['is_active', 'estado', 'reset_token', 'reset_token_expira'])


def consumir_token(token):
    if not token:
        return None
    user = User.objects.filter(reset_token=token).first()
    if not user or user.reset_token_expira is None or user.reset_token_expira < timezone.now():
        return None
    user.reset_token = ''
    user.reset_token_expira = None
    user.save(update_fields=['reset_token', 'reset_token_expira'])
    return user