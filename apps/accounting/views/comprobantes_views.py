from django.db import connection
from django.db import connection
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.accounting.models import Comprobante
from apps.accounting.serializers.comprobantes import ComprobanteSerializer
from apps.users.services.scopes import user_scope



class ComprobanteViewSet(viewsets.ModelViewSet):
    pagination_class   = None
    serializer_class   = ComprobanteSerializer
    module             = 'comprobantes'
    permission_classes = [IsAuthenticated]
    queryset           = Comprobante.all_objects.all()

    def get_queryset(self):
        scope = user_scope(self.request.user)
        qs = Comprobante.all_objects.all().order_by('codigo')
        if scope['comprobantes'] is not None:
            qs = qs.filter(codigo__in=scope['comprobantes'])
        return qs

    def perform_create(self, serializer):
        codigo = serializer.validated_data.get('codigo', '')
        deleted_obj = Comprobante.all_objects.filter(codigo=codigo, deleted=True).first()
        if deleted_obj:
            deleted_obj.deleted        = False
            deleted_obj.deleted_at     = None
            deleted_obj.deleted_by     = None
            deleted_obj.descripcion    = serializer.validated_data.get('descripcion', deleted_obj.descripcion)
            deleted_obj.numero_inicial = serializer.validated_data.get('numero_inicial', deleted_obj.numero_inicial)
            deleted_obj.activo         = serializer.validated_data.get('activo', deleted_obj.activo)
            deleted_obj.updated_by     = self.request.user
            deleted_obj.save()
            return
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=True, methods=['delete'], url_path='eliminar-definitivo')
    def eliminar_definitivo(self, request, pk=None):
        try:
            comp = Comprobante.all_objects.get(pk=pk)
            comp.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Comprobante.DoesNotExist:
            return Response({'detail': 'No encontrado'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='lista-eliminados')
    def lista_eliminados(self, request):
        qs = Comprobante.all_objects.filter(deleted=True).order_by('codigo')
        return Response(ComprobanteSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'], url_path='restaurar')
    def restaurar(self, request, pk=None):
        try:
            comp = Comprobante.all_objects.get(pk=pk, deleted=True)
            comp.deleted    = False
            comp.deleted_at = None
            comp.deleted_by = None
            comp.updated_by = request.user
            comp.save()
            return Response(ComprobanteSerializer(comp).data)
        except Comprobante.DoesNotExist:
            return Response({'detail': 'No encontrado'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='siguiente-numero')
    def siguiente_numero(self, request):
        codigo = request.query_params.get('codigo')
        if not codigo:
            return Response({'detail': 'Parámetro "codigo" requerido.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            comp = Comprobante.objects.get(codigo=codigo, deleted=False)
        except Comprobante.DoesNotExist:
            return Response({'detail': f'No existe comprobante "{codigo}"'},
                            status=status.HTTP_404_NOT_FOUND)
        scope = user_scope(request.user)
        if scope['comprobantes'] is not None and comp.codigo not in scope['comprobantes']:
            return Response({'detail': f'El comprobante "{codigo}" no está permitido para su rol.'},
                            status=status.HTTP_403_FORBIDDEN)
        with connection.cursor() as c:
            c.execute(
                "SELECT COALESCE(MAX(num_comprob), 0) "
                "FROM accounting_movicont "
                "WHERE cod_comprob_id = %s",
                [codigo]
            )
            max_num = c.fetchone()[0]
        return Response({'codigo': comp.codigo, 'siguiente': max_num + 1})

    @action(detail=False, methods=['get'], url_path='diagnostico')
    def diagnostico(self, request):
        with connection.cursor() as c:
            c.execute(
                "SELECT codigo, descripcion, deleted, activo "
                "FROM accounting_comprobante ORDER BY codigo"
            )
            cols = [col[0] for col in c.description]
            rows = [dict(zip(cols, row)) for row in c.fetchall()]
        return Response({'total': len(rows), 'registros': rows})