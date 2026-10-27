from django.db.models import Q, Exists, OuterRef
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounting.models import Tercero
from apps.congregacion.models import Congregacion
from apps.core.utils.exceptions import ServiceNotConfigured
from apps.membresia.import_export import CAMPOS_MEMBRESIA, convertir_campo
from apps.membresia.models import Membresia, AnotacionPastor, AnotacionMisionero
from apps.membresia.serializers.membresia import (
    MembresiaSerializer, TerceroReferenciaSerializer,
)
from apps.core.services import cloudinary_service
from apps.core.utils.pagination import StandardPagination
from apps.core.views import HardDeleteMixin

MAX_FOTO_BYTES = 5 * 1024 * 1024  # 5 MB
TIPOS_IMAGEN  = {'image/jpeg', 'image/png', 'image/webp'}


class MembresiaViewSet(HardDeleteMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = MembresiaSerializer
    module             = 'membresias'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['tercero__cedula', 'tercero__nombre1', 'tercero__nombre2',
                          'tercero__apellido1', 'tercero__apellido2',
                          'tercero__razon_social', 'tercero__celular',
                          'congregacion__codigo', 'congregacion__nombre']
    filterset_fields   = ['estado', 'sw_bautizado', 'sw_promesado', 'estado_civil',
                          'congregacion']
    ordering_fields    = ['tercero__cedula', 'tercero__apellido1', 'tercero__nombre1',
                          'created_at', 'estado', 'fecha_bautismo', 'fecha_llegada']
    ordering           = ['tercero__apellido1', 'tercero__nombre1']
    queryset           = Membresia.objects.filter(deleted=False).select_related(
                             'tercero', 'congregacion', 'estado').annotate(
        tiene_notas_pastor=Exists(
            AnotacionPastor.objects.filter(cedula=OuterRef('tercero_id'))),
        tiene_notas_misionero=Exists(
            AnotacionMisionero.objects.filter(cedula=OuterRef('tercero_id'))),
    )

    def get_queryset(self):
        qs = super().get_queryset()
        p  = self.request.query_params
        if p.get('solo_bautizados') == '1': qs = qs.filter(sw_bautizado=True)
        if p.get('solo_promesados') == '1': qs = qs.filter(sw_promesado=True)
        if p.get('q'):
            termino = p['q'].strip()
            qs = qs.filter(
                Q(tercero__cedula__icontains=termino)
                | Q(tercero__nombre1__icontains=termino)
                | Q(tercero__apellido1__icontains=termino)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='cedulas-con-membresia')
    def cedulas_con_membresia(self, request):
        """Cédulas que ya tienen membresía, para marcarlas en el buscador de terceros."""
        return Response(sorted(Membresia.objects.values_list('tercero_id', flat=True)))

    @action(detail=False, methods=['get'], url_path='tercero-por-cedula')
    def tercero_por_cedula(self, request):
        """Busca un tercero por cédula exacta para precargar la sección 1."""
        cedula = (request.query_params.get('cedula') or '').strip()
        if not cedula:
            return Response({'detail': 'Debe indicar la cédula.'}, status=400)

        tercero = Tercero.all_objects.filter(cedula=cedula).first()
        if tercero is None:
            return Response({'existe': False, 'tercero': None, 'ya_tiene_membresia': False})

        previa = Membresia.all_objects.filter(tercero_id=cedula).first()
        return Response({
            'existe':             True,
            'tercero':            TerceroReferenciaSerializer(tercero).data,
            'ya_tiene_membresia': previa is not None and not previa.deleted,
            'membresia_dada_de_baja': previa is not None and previa.deleted,
        })

    @action(detail=False, methods=['post'], url_path='importar')
    def importar(self, request):
        """Importa membresías desde los registros ya parseados del CSV."""
        modo = request.data.get('modo')
        registros = request.data.get('registros')
        if modo not in ('solo_nuevos', 'reemplazar', 'ambos'):
            return Response(
                {'detail': "Modo inválido. Use: 'solo_nuevos', 'reemplazar' o 'ambos'."},
                status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(registros, list) or not registros:
            return Response({'detail': 'No se recibieron registros.'},
                            status=status.HTTP_400_BAD_REQUEST)

        filas = [
            {str(k).strip().lower(): v for k, v in dato.items()}
            for dato in registros if isinstance(dato, dict)
        ]
        cedulas = [str(f.get('cedula') or '').strip() for f in filas]

        terceros = {
            t.cedula: t
            for t in Tercero.all_objects.filter(cedula__in=cedulas)
        }
        existentes = {
            m.tercero_id: m
            for m in Membresia.all_objects.filter(tercero_id__in=cedulas)
        }
        congregaciones = {}

        creados = actualizados = omitidos = 0
        errores = []

        for indice, dato in enumerate(filas, start=2):
            try:
                fila = int(dato.get('_fila') or indice)
            except (TypeError, ValueError):
                fila = indice

            cedula = str(dato.get('cedula') or '').strip()
            if not cedula:
                errores.append({'fila': fila, 'cedula': '', 'error': 'Falta cédula'})
                continue

            tercero = terceros.get(cedula)
            if tercero is None:
                errores.append({
                    'fila': fila, 'cedula': cedula,
                    'error': 'No existe un tercero con esta cédula',
                })
                continue
            if tercero.deleted:
                errores.append({
                    'fila': fila, 'cedula': cedula,
                    'error': 'El tercero está dado de baja',
                })
                continue

            existente = existentes.get(cedula)
            if existente and modo == 'solo_nuevos':
                omitidos += 1
                continue
            if not existente and modo == 'reemplazar':
                omitidos += 1
                continue

            datos, errores_fila = self._datos_importacion(dato, congregaciones)
            if errores_fila:
                errores.append({
                    'fila': fila, 'cedula': cedula,
                    'error': '; '.join(errores_fila),
                })
                continue

            try:
                if existente:
                    if existente.deleted:
                        existente.deleted = False
                        existente.deleted_at = None
                        existente.deleted_by = None
                    for campo, valor in datos.items():
                        setattr(existente, campo, valor)
                    existente.updated_by = request.user
                    existente.save()
                    actualizados += 1
                else:
                    Membresia.objects.create(
                        tercero=tercero, created_by=request.user, **datos)
                    creados += 1
            except Exception as exc:
                errores.append({
                    'fila': fila, 'cedula': cedula, 'error': str(exc),
                })

        return Response({
            'creados':      creados,
            'actualizados': actualizados,
            'omitidos':     omitidos,
            'errores':      errores,
        })

    @staticmethod
    def _datos_importacion(dato, congregaciones):
        """Convierte y valida los campos de una fila del CSV."""
        datos, errores = {}, []

        for campo in CAMPOS_MEMBRESIA:
            if campo in ('cedula', 'congregacion') or campo not in dato:
                continue
            valor, error = convertir_campo(campo, dato[campo])
            if error:
                errores.append(error)
            else:
                datos[campo] = valor

        # El estado vacío se interpreta como activo (valor por defecto).
        if 'estado' in dato and not datos.get('estado'):
            from apps.membresia.models import EstadoMembresia
            datos['estado'] = EstadoMembresia.objects.get(estado='1')

        if 'congregacion' in dato:
            codigo = str(dato.get('congregacion') or '').strip()
            if not codigo:
                datos['congregacion'] = None
            else:
                if codigo not in congregaciones:
                    congregaciones[codigo] = (
                        Congregacion.all_objects.filter(codigo=codigo).first())
                congregacion = congregaciones[codigo]
                if congregacion is None:
                    errores.append(
                        f'congregacion: no existe el código {codigo}')
                elif congregacion.deleted:
                    errores.append(
                        f'congregacion: el código {codigo} está dado de baja')
                else:
                    datos['congregacion'] = congregacion

        return datos, errores

    @action(detail=True, methods=['post', 'delete'], url_path='foto',
            parser_classes=[MultiPartParser, FormParser])
    def foto(self, request, pk=None):
        """POST: sube una foto a Cloudinary y guarda su URL. DELETE: la quita."""
        membresia = self.get_object()

        if request.method == 'DELETE':
            cloudinary_service.eliminar_foto(membresia.foto_public_id)
            membresia.foto           = ''
            membresia.foto_public_id = ''
            membresia.updated_by     = request.user
            membresia.save(update_fields=['foto', 'foto_public_id', 'updated_by', 'updated_at'])
            return Response({'foto': ''})

        archivo = request.FILES.get('imagen')
        if not archivo:
            return Response({'detail': 'Debe adjuntar una imagen en el campo "imagen".'},
                            status=status.HTTP_400_BAD_REQUEST)
        if archivo.size > MAX_FOTO_BYTES:
            return Response({'detail': 'La imagen no puede superar los 5 MB.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if archivo.content_type not in TIPOS_IMAGEN:
            return Response({'detail': 'Formato no permitido. Use JPG, PNG o WEBP.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            subida = cloudinary_service.subir_foto(
                archivo, public_id=f'membresia_{membresia.id}')
        except ServiceNotConfigured as e:
            return Response({'detail': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            return Response({'detail': 'No se pudo subir la imagen. Intente de nuevo.'},
                            status=status.HTTP_502_BAD_GATEWAY)

        membresia.foto           = subida['secure_url']
        membresia.foto_public_id = subida['public_id']
        membresia.updated_by     = request.user
        membresia.save(update_fields=['foto', 'foto_public_id', 'updated_by', 'updated_at'])
        return Response({'foto': membresia.foto})
