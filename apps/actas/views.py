from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.actas.models import ActaReunion, ActaFirma
from apps.actas.serializers import ActaReunionSerializer, ActaFirmaSerializer
from apps.core.permissions import ModulePermission
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin
from apps.audit.mixins import AuditMixin
from apps.users.services.role_context import es_superusuario_efectivo


class ActaReunionViewSet(AuditMixin, HardDeleteMixin, viewsets.ModelViewSet):
    queryset           = ActaReunion.objects.annotate(
        total_firmas=Count('firmas'),
        firmas_completadas=Count('firmas', filter=Q(firmas__fecha_firma__isnull=False)),
    ).select_related('congregacion', 'autor').prefetch_related('firmas__usuario', 'firmas__miembro')
    serializer_class   = ActaReunionSerializer
    pagination_class   = StandardPagination
    module             = 'actas'
    permission_classes = [ModulePermission]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['congregacion', 'tipo', 'estado', 'fecha_reunion']
    search_fields      = ['codigo', 'titulo', 'contenido']
    ordering_fields    = ['fecha_reunion', 'codigo', 'created_at']
    ordering           = ['-fecha_reunion', '-codigo']

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)

    @action(detail=False, methods=['get'], url_path='siguiente-codigo')
    def siguiente_codigo(self, request):
        """Devuelve el siguiente código numérico disponible para una congregación."""
        congregacion = request.query_params.get('congregacion')
        if not congregacion:
            return Response(
                {'detail': 'Indique la congregación.'},
                status=status.HTTP_400_BAD_REQUEST)

        max_num = 0
        for codigo in ActaReunion.objects.filter(congregacion__codigo=congregacion).values_list('codigo', flat=True):
            try:
                n = int(str(codigo).strip())
                if n > max_num:
                    max_num = n
            except ValueError:
                continue
        return Response({'siguiente_codigo': str(max_num + 1)})

    @action(detail=True, methods=['post'], url_path='firmar')
    def firmar(self, request, pk=None):
        """Firma de un usuario autenticado usando su contraseña."""
        acta = self.get_object()
        password = request.data.get('password', '')
        confirmacion_doc = request.data.get('confirmacion_doc', '')

        if not request.user.check_password(password):
            return Response(
                {'detail': 'Contraseña incorrecta.'},
                status=status.HTTP_400_BAD_REQUEST)

        firma, _ = ActaFirma.objects.get_or_create(
            acta=acta, usuario=request.user,
            defaults={'miembro': None},
        )
        firma.tipo_firma = ActaFirma.TIPO_PASSWORD
        firma.fecha_firma = timezone.now()
        firma.ip_firma = self._client_ip(request)
        firma.confirmacion_doc = confirmacion_doc
        firma.save(update_fields=['tipo_firma', 'fecha_firma', 'ip_firma', 'confirmacion_doc'])

        return Response(ActaFirmaSerializer(firma).data)

    @action(detail=True, methods=['post'], url_path='enviar-firmas')
    def enviar_firmas(self, request, pk=None):
        """Genera tokens y envía correos a miembros sin login para que firmen."""
        acta = self.get_object()
        miembros_ids = request.data.get('miembros', [])
        usuarios_ids = request.data.get('usuarios', [])

        if not isinstance(miembros_ids, list):
            miembros_ids = []
        if not isinstance(usuarios_ids, list):
            usuarios_ids = []

        enviados = 0
        errores = []

        # Miembros (sin login) -> token por correo
        from apps.membresia.models import Membresia
        for miembro_id in miembros_ids:
            try:
                miembro = Membresia.objects.select_related('tercero').get(pk=miembro_id)
            except Membresia.DoesNotExist:
                errores.append({'miembro': miembro_id, 'error': 'No existe'})
                continue

            correo = getattr(miembro.tercero, 'email', '') or getattr(miembro.tercero, 'correo', '')
            if not correo:
                errores.append({'miembro': str(miembro), 'error': 'No tiene correo registrado'})
                continue

            firma, _ = ActaFirma.objects.get_or_create(
                acta=acta, miembro=miembro,
                defaults={'usuario': None},
            )
            token = firma.generar_token()
            firma.correo_enviado = timezone.now()
            firma.save(update_fields=['token', 'token_expira', 'correo_enviado'])

            url = f"{settings.CORS_ALLOWED_ORIGINS[0]}/firmar-acta/{token}"
            asunto = f"Firma requerida: Acta {acta.codigo} - {acta.titulo}"
            mensaje = (
                f"Hola {miembro.nombre_completo},\n\n"
                f"Se requiere tu firma para el acta '{acta.titulo}' ({acta.congregacion.nombre}).\n"
                f"Puedes revisarla y firmarla en el siguiente enlace:\n{url}\n\n"
                f"Este enlace expira el {firma.token_expira.strftime('%d/%m/%Y %H:%M')}.\n"
            )
            try:
                send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL, [correo])
                enviados += 1
            except Exception as exc:
                errores.append({'miembro': str(miembro), 'error': str(exc)})

        return Response({'enviados': enviados, 'errores': errores})

    @action(detail=True, methods=['post'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        """Cambia el estado del acta: 1=borrador, 2=revisada, 3=firmada, 4=archivada."""
        acta = self.get_object()
        nuevo = request.data.get('estado')
        if nuevo not in [c[0] for c in ActaReunion.ESTADOS]:
            return Response(
                {'detail': 'Estado no válido.'},
                status=status.HTTP_400_BAD_REQUEST)
        acta.estado = nuevo
        acta.save(update_fields=['estado', 'updated_at'])
        return Response(ActaReunionSerializer(acta).data)

    def _client_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class FirmaPublicaViewSet(viewsets.ViewSet):
    """Endpoints públicos (con token) para firmar actas sin login."""
    permission_classes = [AllowAny]

    def retrieve(self, request, pk=None):
        """GET /api/actas/firmar/<token>/ : devuelve el acta asociada al token."""
        firma = get_object_or_404(ActaFirma, token=pk, token_expira__gt=timezone.now())
        return Response({
            'acta': ActaReunionSerializer(firma.acta).data,
            'firmante': firma.miembro.nombre_completo if firma.miembro else None,
            'expira': firma.token_expira,
        })

    def create(self, request, pk=None):
        """POST /api/actas/firmar/<token>/ : registra la firma con el token."""
        firma = get_object_or_404(ActaFirma, token=pk, token_expira__gt=timezone.now())
        if firma.fecha_firma:
            return Response(
                {'detail': 'Esta firma ya fue registrada.'},
                status=status.HTTP_400_BAD_REQUEST)

        confirmacion_doc = request.data.get('confirmacion_doc', '')
        firma.tipo_firma = ActaFirma.TIPO_TOKEN
        firma.fecha_firma = timezone.now()
        firma.ip_firma = self._client_ip(request)
        firma.confirmacion_doc = confirmacion_doc
        firma.save(update_fields=['tipo_firma', 'fecha_firma', 'ip_firma', 'confirmacion_doc'])

        return Response(ActaFirmaSerializer(firma).data)

    def _client_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
