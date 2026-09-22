from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from apps.accounting.models import MoviCont, Cuenta, Tercero, CentroCosto
from apps.accounting.services.journal_service import JournalService
from apps.users.services.scopes import user_scope


class MoviContLineaSerializer(serializers.ModelSerializer):
    """Valida una línea del movimiento (usada anidada en la escritura)."""
    cuenta       = serializers.SlugRelatedField(slug_field='codigo',
                                                queryset=Cuenta.objects.all())
    cedula       = serializers.SlugRelatedField(slug_field='cedula',
                                                queryset=Tercero.objects.all(),
                                                allow_null=True, required=False)
    centro_costo = serializers.SlugRelatedField(slug_field='codigo',
                                                queryset=CentroCosto.objects.all(),
                                                allow_null=True, required=False)

    class Meta:
        model  = MoviCont
        fields = ['cuenta', 'observacion', 'cedula', 'centro_costo',
                  'vr_debitos', 'vr_creditos']


class MoviContCreateSerializer(serializers.Serializer):
    """Crea un movimiento contable completo (cabecera + líneas)."""
    cod_comprob = serializers.CharField()
    fecha       = serializers.DateField()
    doc_ref     = serializers.CharField(required=False, allow_blank=True, default='')
    doc_soporte = serializers.CharField(required=False, allow_blank=True, default='')
    lineas      = MoviContLineaSerializer(many=True)

    def validate(self, data):
        scope = user_scope(self.context['request'].user)
        errores = []

        if scope['comprobantes'] is not None and data['cod_comprob'] not in scope['comprobantes']:
            errores.append(f"El comprobante '{data['cod_comprob']}' no está permitido para su rol.")

        for i, l in enumerate(data['lineas'], start=1):
            if scope['cuentas'] is not None and l['cuenta'].codigo not in scope['cuentas']:
                errores.append(f"Línea {i}: la cuenta {l['cuenta'].codigo} no está permitida para su rol.")
            if scope['centros_costo'] is not None:
                cc = l.get('centro_costo')
                if not cc or cc.codigo not in scope['centros_costo']:
                    errores.append(f"Línea {i}: el centro de costo no está permitido para su rol.")

        lineas_raw = [{
            'vr_debitos': l.get('vr_debitos', 0),
            'vr_creditos': l.get('vr_creditos', 0),
            'cuenta': l['cuenta'].codigo,
        } for l in data['lineas']]
        try:
            JournalService.validar_partida_doble(lineas_raw)
        except DjangoValidationError as e:
            try:
                errores.extend(e.messages)
            except AttributeError:
                errores.extend([str(m) for m in e.message_dict.values()])

        if errores:
            raise serializers.ValidationError({'detail': errores})
        return data

    def create(self, validated_data):
        lineas_data = validated_data.pop('lineas')
        lineas_clean = []
        for l in lineas_data:
            row = dict(l)
            row['cuenta']       = l['cuenta'].codigo
            row['cedula']       = l['cedula'].cedula if l.get('cedula') else None
            row['centro_costo'] = l['centro_costo'].codigo if l.get('centro_costo') else None
            lineas_clean.append(row)
        validated_data['lineas'] = lineas_clean
        return JournalService.crear_movimiento(
            user=self.context['request'].user, data=validated_data)


class MoviContUpdateSerializer(serializers.Serializer):
    """Actualiza una línea de movimiento (los campos clave no son editables)."""
    cod_comprob  = serializers.CharField()
    num_comprob  = serializers.IntegerField()
    item_comprob = serializers.IntegerField()
    fecha        = serializers.DateField(required=False)
    cuenta       = serializers.SlugRelatedField(slug_field='codigo',
                                                queryset=Cuenta.objects.all(),
                                                required=False)
    cedula       = serializers.SlugRelatedField(slug_field='cedula',
                                                queryset=Tercero.objects.all(),
                                                allow_null=True, required=False)
    centro_costo = serializers.SlugRelatedField(slug_field='codigo',
                                                queryset=CentroCosto.objects.all(),
                                                allow_null=True, required=False)
    doc_ref      = serializers.CharField(required=False, allow_blank=True, max_length=14)
    observacion  = serializers.CharField(required=False, allow_blank=True, max_length=200)
    doc_soporte  = serializers.CharField(required=False, allow_blank=True, max_length=15)
    vr_debitos   = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, min_value=0)
    vr_creditos  = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, min_value=0)

    def validate(self, data):
        scope = user_scope(self.context['request'].user)
        errores = []
        if scope['comprobantes'] is not None and data['cod_comprob'] not in scope['comprobantes']:
            errores.append(f"El comprobante '{data['cod_comprob']}' no está permitido para su rol.")
        cta = data.get('cuenta')
        if cta is not None and scope['cuentas'] is not None and cta.codigo not in scope['cuentas']:
            errores.append(f"La cuenta {cta.codigo} no está permitida para su rol.")
        cc = data.get('centro_costo')
        if cc is not None and scope['centros_costo'] is not None and cc.codigo not in scope['centros_costo']:
            errores.append(f"El centro de costo {cc.codigo} no está permitido para su rol.")
        if errores:
            raise serializers.ValidationError({'detail': errores})
        return data


class MoviContSerializer(serializers.ModelSerializer):
    """Lectura de una línea de MoviCont."""
    cuenta_descripcion = serializers.CharField(source='cuenta.descripcion', read_only=True)
    tercero_nombre     = serializers.SerializerMethodField()
    cc_descripcion     = serializers.CharField(source='centro_costo.descripcion', read_only=True)

    class Meta:
        model  = MoviCont
        fields = ['id', 'cod_comprob', 'num_comprob', 'item_comprob', 'fecha',
                  'cuenta', 'cuenta_descripcion', 'doc_ref', 'observacion',
                  'cedula', 'tercero_nombre', 'centro_costo', 'cc_descripcion',
                  'doc_soporte', 'vr_debitos', 'vr_creditos']

    def get_tercero_nombre(self, obj):
        return obj.cedula.nombre_completo if obj.cedula else ''


class MoviContAsientoSerializer(serializers.Serializer):
    """Resumen agrupado de un movimiento contable (referencia + totales)."""
    cod_comprob    = serializers.CharField()
    num_comprob    = serializers.IntegerField()
    fecha          = serializers.DateField()
    num_lineas     = serializers.IntegerField()
    total_debitos  = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_creditos = serializers.DecimalField(max_digits=14, decimal_places=2)
    referencia     = serializers.SerializerMethodField()

    def get_referencia(self, obj):
        return f"{obj['cod_comprob']}-{obj['num_comprob']:06d}"
