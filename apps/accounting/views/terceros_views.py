import csv

from django.http import HttpResponse
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.accounting.models import Tercero
from apps.accounting.serializers.terceros import TerceroSerializer
from apps.core.utils.pagination import StandardPagination


EXPORT_COLUMNAS = [
    ('Cedula',            'cedula'),
    ('TipoDocumento',     'tipo_documento'),
    ('LugarExpCedula',    'lugar_exp_cedula'),
    ('TipoPersona',       'tipo_persona'),
    ('Nombre1',           'nombre1'),
    ('Nombre2',           'nombre2'),
    ('Apellido1',         'apellido1'),
    ('Apellido2',         'apellido2'),
    ('RazonSocial',       'razon_social'),
    ('Direccion',         'direccion'),
    ('Telefono1',         'telefono1'),
    ('Telefono2',         'telefono2'),
    ('Celular',           'celular'),
    ('eMail',             'email'),
    ('Fax',               'fax'),
    ('Barrio',            'barrio'),
    ('LugarNacimiento',   'lugar_nacimiento'),
    ('Sexo',              'sexo'),
    ('Comentarios',       'comentarios'),
    ('Distrito',          'distrito'),
    ('Departamento',      'departamento'),
    ('Municipio',         'municipio'),
    ('FechaNacimiento',   'fecha_nacimiento'),
]


class TerceroViewSet(viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    serializer_class   = TerceroSerializer
    module             = 'terceros'
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['cedula','razon_social','apellido1','nombre1']
    filterset_fields   = ['tipo_documento', 'tipo_persona', 'is_active']
    ordering_fields    = ['cedula', 'tipo_documento', 'apellido1', 'nombre1',
                          'razon_social', 'telefono1', 'email', 'celular']
    ordering           = ['apellido1', 'nombre1', 'razon_social']
    queryset           = Tercero.objects.filter(deleted=False)
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='siguiente-cedula')
    def siguiente_cedula(self, request):
        max_num = 0
        for c in Tercero.objects.filter(deleted=False).values_list('cedula', flat=True):
            try:
                n = int(str(c).strip())
                if n > max_num:
                    max_num = n
            except ValueError:
                continue
        return Response({'siguiente_cedula': str(max_num + 1)})

    @action(detail=False, methods=['get'], url_path='exportar')
    def exportar(self, request):
        queryset = self.filter_queryset(self.get_queryset()).order_by(
            'apellido1', 'nombre1', 'razon_social')

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="terceros.csv"'
        response.write('\ufeff')

        writer = csv.writer(response)
        writer.writerow([c[0] for c in EXPORT_COLUMNAS])
        for t in queryset:
            fila = []
            for _, campo in EXPORT_COLUMNAS:
                valor = getattr(t, campo)
                if isinstance(valor, str):
                    valor = valor.replace('\r', ' ').replace('\n', ' ')
                fila.append(valor)
            writer.writerow(fila)
        return response

    @action(detail=False, methods=['post'], url_path='importar')
    def importar(self, request):
        modo = request.data.get('modo')
        registros = request.data.get('registros')
        if modo not in ('solo_nuevos', 'reemplazar', 'ambos'):
            return Response(
                {'detail': "Modo inválido. Use: 'solo_nuevos', 'reemplazar' o 'ambos'."},
                status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(registros, list) or not registros:
            return Response({'detail': 'No se recibieron registros.'},
                            status=status.HTTP_400_BAD_REQUEST)

        cedulas = [str(r.get('cedula', '')).strip() for r in registros]
        existentes = {
            t.cedula: t
            for t in Tercero.objects.filter(cedula__in=cedulas, deleted=False)
        }

        creados = actualizados = omitidos = 0
        errores = []
        for i, dato in enumerate(registros, start=1):
            cedula = str(dato.get('cedula', '')).strip()
            if not cedula:
                errores.append({'fila': i, 'cedula': '', 'error': 'Falta cédula'})
                continue

            existente = existentes.get(cedula)
            if existente and modo == 'solo_nuevos':
                omitidos += 1
                continue
            if not existente and modo == 'reemplazar':
                omitidos += 1
                continue

            serializer = TerceroSerializer(instance=existente, data=dato, partial=True)
            if serializer.is_valid():
                if existente:
                    serializer.save(updated_by=request.user)
                    actualizados += 1
                else:
                    serializer.save(created_by=request.user)
                    creados += 1
            else:
                msgs = '; '.join(f'{k}: {v[0]}' for k, v in serializer.errors.items())
                errores.append({'fila': i, 'cedula': cedula, 'error': msgs})

        return Response({
            'creados':     creados,
            'actualizados': actualizados,
            'omitidos':    omitidos,
            'errores':     errores,
        })