from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounting.models import PlantillaContable, DetallePlantilla



# ── Serializers ──────────────────────────────────────────────────────────────

class DetallePlantillaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DetallePlantilla
        fields = [
            'id', 'plantilla', 'item', 'cuenta', 'doc_ref', 'observacion',
            'tipo_mov', 'valor', 'base', 'cedula', 'centro_costo',
            'comentarios', 'doc_soporte',
        ]

    def validate(self, data):
        # Verificar que no exista ya ese item en la misma plantilla (excepto al editar)
        plantilla = data.get('plantilla', getattr(self.instance, 'plantilla', None))
        item      = data.get('item',      getattr(self.instance, 'item',      None))
        qs = DetallePlantilla.objects.filter(plantilla=plantilla, item=item, deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'item': f"Ya existe el ítem {item} en esta plantilla."}
            )
        return data


class PlantillaSerializer(serializers.ModelSerializer):
    detalles        = DetallePlantillaSerializer(many=True, read_only=True)
    comprobante_desc= serializers.CharField(
        source='comprobante.descripcion', read_only=True, default=''
    )

    class Meta:
        model  = PlantillaContable
        fields = [
            'id', 'cod_plantilla', 'nombre', 'descripcion',
            'comprobante', 'comprobante_desc', 'detalles', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        return PlantillaContable.objects.create(
            created_by=self.context['request'].user,
            **validated_data
        )

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


# ── ViewSets ─────────────────────────────────────────────────────────────────

class PlantillaViewSet(viewsets.ModelViewSet):
    module             = 'plantillas'
    permission_classes = [IsAuthenticated]
    serializer_class   = PlantillaSerializer
    search_fields      = ['cod_plantilla', 'nombre']
    pagination_class   = None  # Sin paginación — el frontend pide todo

    def get_queryset(self):
        return (
            PlantillaContable.objects
            .filter(deleted=False)
            .prefetch_related('detalles')
            .order_by('cod_plantilla')
        )

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)


class DetallePlantillaViewSet(viewsets.ModelViewSet):
    """
    CRUD completo de renglones/detalles de plantilla.
    GET    /api/plantillas/detalles/?plantilla=<id>
    POST   /api/plantillas/detalles/
    PUT    /api/plantillas/detalles/<id>/
    DELETE /api/plantillas/detalles/<id>/
    POST   /api/plantillas/detalles/bulk-import/  ← importación masiva
    """
    module             = 'plantillas'
    permission_classes = [IsAuthenticated]
    serializer_class   = DetallePlantillaSerializer
    pagination_class   = None

    def get_queryset(self):
        qs = DetallePlantilla.objects.filter(deleted=False).order_by('item')
        plantilla_id = self.request.query_params.get('plantilla')
        if plantilla_id:
            qs = qs.filter(plantilla_id=plantilla_id)
        return qs

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        """
        Importación masiva de detalles — upsert por plantilla+item.
        Recibe: { registros: [ {plantilla_id, item, cuenta, ...}, ... ] }
        Devuelve: { creados, actualizados, errores: [{item, error}] }
        """
        from django.db import transaction
        registros = request.data.get('registros', [])
        if not registros:
            return Response({'detail': 'No hay registros'}, status=400)

        creados = 0; actualizados = 0; errores = []

        with transaction.atomic():
            for reg in registros:
                try:
                    pid  = reg.get('plantilla')
                    item = reg.get('item')
                    existing = DetallePlantilla.objects.filter(
                        plantilla_id=pid, item=item, deleted=False
                    ).first()

                    campos = {
                        'plantilla_id': pid,
                        'item':         item,
                        'cuenta':       reg.get('cuenta',''),
                        'doc_ref':      reg.get('doc_ref',''),
                        'observacion':  reg.get('observacion',''),
                        'tipo_mov':     reg.get('tipo_mov',''),
                        'valor':        reg.get('valor',''),
                        'base':         reg.get('base',''),
                        'cedula':       reg.get('cedula',''),
                        'centro_costo': reg.get('centro_costo',''),
                        'comentarios':  reg.get('comentarios',''),
                        'doc_soporte':  reg.get('doc_soporte',''),
                    }

                    if existing:
                        for k, v in campos.items():
                            setattr(existing, k, v)
                        existing.updated_by = request.user
                        existing.save()
                        actualizados += 1
                    else:
                        DetallePlantilla.objects.create(
                            created_by=request.user, **campos
                        )
                        creados += 1
                except Exception as e:
                    errores.append({'item': reg.get('item'), 'error': str(e)})

        return Response({'creados': creados, 'actualizados': actualizados, 'errores': errores})


# ── Routers separados para evitar conflicto de rutas ─────────────────────────

router_plantillas = DefaultRouter()
router_plantillas.register(r'', PlantillaViewSet, basename='plantilla')

router_detalles = DefaultRouter()
router_detalles.register(r'', DetallePlantillaViewSet, basename='detalle-plantilla')

urlpatterns = [
    path('detalles/', include(router_detalles.urls)),   # /api/plantillas/detalles/
    path('',          include(router_plantillas.urls)), # /api/plantillas/
]