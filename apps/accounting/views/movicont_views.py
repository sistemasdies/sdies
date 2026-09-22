from datetime import datetime, date
from decimal import Decimal, InvalidOperation

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count
from django.core.exceptions import ValidationError as DjangoValidationError
from apps.accounting.models import (
    MoviCont, Comprobante, Cuenta, Tercero, CentroCosto
)
from apps.accounting.serializers.movicont import (
    MoviContSerializer, MoviContCreateSerializer, MoviContAsientoSerializer,
    MoviContUpdateSerializer
)
from apps.users.services.scopes import user_scope
from apps.core.utils.pagination import StandardPagination


COLUMNAS_IMPORT = [
    'cod_comprob', 'num_comprob', 'item_comprob', 'cuenta', 'doc_ref',
    'observacion', 'cedula', 'centro_costo', 'doc_soporte',
    'vr_debitos', 'vr_creditos', 'fecha',
]


def _parsear_fecha(valor):
    texto = str(valor or '').strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y'):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


def _multi(p, key):
    """Extrae una lista de valores de un query param (repetido o separado por coma)."""
    vals = []
    for v in p.getlist(key):
        vals.extend(x.strip() for x in v.split(',') if x.strip())
    return vals


def _numero(p, key):
    """Parsea un número de query param (o None si inválido)."""
    valor = p.get(key)
    if not valor:
        return None
    try:
        return Decimal(str(valor).replace(',', '.'))
    except (InvalidOperation, TypeError, ValueError):
        return None


class MoviContViewSet(viewsets.GenericViewSet):
    module             = 'asientos'
    permission_classes = [IsAuthenticated]
    pagination_class   = StandardPagination

    def get_queryset(self):
        qs = MoviCont.objects.filter(deleted=False)
        scope = user_scope(getattr(self, 'request', None) and self.request.user)
        if scope['comprobantes'] is not None:
            qs = qs.filter(cod_comprob__codigo__in=scope['comprobantes'])
        if scope['cuentas'] is not None:
            qs = qs.filter(cuenta__codigo__in=scope['cuentas'])
        if scope['centros_costo'] is not None:
            qs = qs.filter(centro_costo__codigo__in=scope['centros_costo'])
        return qs

    def list(self, request):
        qs = self.get_queryset()
        p  = request.query_params
        if p.get('fecha_desde'):  qs = qs.filter(fecha__gte=p['fecha_desde'])
        if p.get('fecha_hasta'):  qs = qs.filter(fecha__lte=p['fecha_hasta'])

        comprobantes = _multi(p, 'comprobante')
        if comprobantes: qs = qs.filter(cod_comprob__codigo__in=comprobantes)
        cuentas = _multi(p, 'cuenta')
        if cuentas: qs = qs.filter(cuenta__codigo__in=cuentas)
        centros = _multi(p, 'centro_costo')
        if centros: qs = qs.filter(centro_costo__codigo__in=centros)
        cedulas = _multi(p, 'cedula')
        if cedulas: qs = qs.filter(cedula__in=cedulas)

        # Rangos por renglón (se aplican antes de agrupar)
        deb_min = _numero(p, 'vr_debitos_min')
        deb_max = _numero(p, 'vr_debitos_max')
        cre_min = _numero(p, 'vr_creditos_min')
        cre_max = _numero(p, 'vr_creditos_max')
        if deb_min is not None: qs = qs.filter(vr_debitos__gte=deb_min)
        if deb_max is not None: qs = qs.filter(vr_debitos__lte=deb_max)
        if cre_min is not None: qs = qs.filter(vr_creditos__gte=cre_min)
        if cre_max is not None: qs = qs.filter(vr_creditos__lte=cre_max)

        num_min = _numero(p, 'num_comprob_min')
        num_max = _numero(p, 'num_comprob_max')
        if num_min is not None: qs = qs.filter(num_comprob__gte=num_min)
        if num_max is not None: qs = qs.filter(num_comprob__lte=num_max)

        doc_ref = p.get('doc_ref')
        if doc_ref: qs = qs.filter(doc_ref__icontains=doc_ref)

        doc_soporte = p.get('doc_soporte')
        if doc_soporte: qs = qs.filter(doc_soporte__icontains=doc_soporte)

        observacion = p.get('observacion')
        if observacion: qs = qs.filter(observacion__icontains=observacion)

        grouped = (
            qs.values('cod_comprob', 'num_comprob', 'fecha')
              .annotate(total_debitos=Sum('vr_debitos'),
                        total_creditos=Sum('vr_creditos'),
                        num_lineas=Count('id'))
              .order_by('-fecha', '-num_comprob', '-cod_comprob')
        )

        orden = p.get('orden')
        campos_orden = {'cod_comprob', 'num_comprob', 'fecha',
                        'num_lineas', 'total_debitos', 'total_creditos'}
        if orden:
            base = orden[1:] if orden.startswith('-') else orden
            if base in campos_orden:
                grouped = grouped.order_by(orden)

        page = self.paginate_queryset(grouped)
        return self.get_paginated_response(MoviContAsientoSerializer(page, many=True).data)

    def create(self, request):
        serializer = MoviContCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        filas = serializer.save()
        return Response(MoviContSerializer(filas, many=True).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='detalle')
    def detalle(self, request):
        cod_comprob = request.query_params.get('cod_comprob')
        num_comprob = request.query_params.get('num_comprob')
        if not cod_comprob or num_comprob is None:
            return Response({'detail': 'Faltan cod_comprob y num_comprob.'},
                            status=status.HTTP_400_BAD_REQUEST)
        filas = self.get_queryset().filter(
            cod_comprob__codigo=cod_comprob, num_comprob=num_comprob
        ).order_by('item_comprob')
        return Response(MoviContSerializer(filas, many=True).data)

    @action(detail=False, methods=['post'], url_path='editar-linea')
    def editar_linea(self, request):
        """Edita una línea: cualquier campo excepto CodComprob/NumComprob/ItemComprob.
        Si se envía 'fecha', se aplica a todas las líneas del movimiento."""
        serializer = MoviContUpdateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        filas = list(self.get_queryset().filter(
            cod_comprob__codigo=v['cod_comprob'], num_comprob=v['num_comprob']))
        if not filas:
            return Response({'detail': 'Movimiento no encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)
        fila = next((f for f in filas if f.item_comprob == v['item_comprob']), None)
        if not fila:
            return Response({'detail': 'Línea del movimiento no encontrada.'},
                            status=status.HTTP_404_NOT_FOUND)

        campos_linea = {}
        for k in ('cuenta', 'doc_ref', 'observacion', 'cedula',
                  'centro_costo', 'doc_soporte', 'vr_debitos', 'vr_creditos'):
            if k in v:
                campos_linea[k] = v[k]

        if 'vr_debitos' in campos_linea and 'vr_creditos' not in campos_linea:
            campos_linea['vr_creditos'] = 0
        elif 'vr_creditos' in campos_linea and 'vr_debitos' not in campos_linea:
            campos_linea['vr_debitos'] = 0

        if 'fecha' in v:
            for f in filas:
                f.fecha = v['fecha']

        for f in filas:
            if f is fila:
                for k, val in campos_linea.items():
                    setattr(f, k, val)
            try:
                f.full_clean(exclude=['cod_comprob', 'num_comprob', 'item_comprob',
                                      'created_by', 'updated_by'])
            except DjangoValidationError as e:
                return Response({'detail': e.messages},
                                status=status.HTTP_400_BAD_REQUEST)
            f.updated_by = request.user

        for f in filas:
            campos = (list(campos_linea.keys())
                      if f is fila else []) + (['fecha'] if 'fecha' in v else [])
            f.save(update_fields=campos + ['updated_by', 'updated_at'])
        return Response(MoviContSerializer(fila).data)

    @action(detail=False, methods=['post'], url_path='editar-lineas')
    def editar_lineas(self, request):
        """Edita varias líneas de un movimiento en una sola llamada.
        Body: { lineas: [{cod_comprob, num_comprob, item_comprob, ...}, ...],
                fecha?: 'YYYY-MM-DD' }
        Si se envía 'fecha' a nivel raíz, se aplica a TODAS las líneas del movimiento."""
        lineas_data = request.data.get('lineas')
        fecha_global = request.data.get('fecha')
        if not isinstance(lineas_data, list) or len(lineas_data) == 0:
            return Response({'detail': 'Se requiere una lista "lineas" no vacía.'},
                            status=status.HTTP_400_BAD_REQUEST)

        first = lineas_data[0]
        cod = first.get('cod_comprob')
        num = first.get('num_comprob')
        if not cod or num is None:
            return Response({'detail': 'Faltan cod_comprob o num_comprob.'},
                            status=status.HTTP_400_BAD_REQUEST)

        filas_map = {}
        for f in self.get_queryset().filter(cod_comprob__codigo=cod, num_comprob=num):
            filas_map[f.item_comprob] = f
        if not filas_map:
            return Response({'detail': 'Movimiento no encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)

        if fecha_global:
            from datetime import date as _date
            try:
                fv = _date.fromisoformat(fecha_global)
            except (ValueError, TypeError):
                return Response({'detail': 'Fecha inválida.'},
                                status=status.HTTP_400_BAD_REQUEST)
            for f in filas_map.values():
                f.fecha = fv

        errores = []
        guardadas = []
        for idx, ld in enumerate(lineas_data):
            it = ld.get('item_comprob')
            fila = filas_map.get(it)
            if fila is None:
                errores.append(f'Línea {idx+1}: item_comprob {it} no encontrada.')
                continue
            ser = MoviContUpdateSerializer(data=ld, context={'request': request})
            if not ser.is_valid():
                errores.append(f'Línea {idx+1} (item {it}): {ser.errors}')
                continue
            v = ser.validated_data
            for k in ('cuenta', 'doc_ref', 'observacion', 'cedula',
                      'centro_costo', 'doc_soporte', 'vr_debitos', 'vr_creditos'):
                if k in v:
                    setattr(fila, k, v[k])
            if 'vr_debitos' in v and 'vr_creditos' not in v:
                fila.vr_creditos = 0
            elif 'vr_creditos' in v and 'vr_debitos' not in v:
                fila.vr_debitos = 0
            try:
                fila.full_clean(exclude=['cod_comprob', 'num_comprob', 'item_comprob',
                                         'created_by', 'updated_by'])
            except DjangoValidationError as e:
                errores.append(f'Línea {idx+1} (item {it}): {e.messages}')
                continue
            fila.updated_by = request.user
            guardadas.append(fila)

        if errores:
            return Response({'detail': errores},
                            status=status.HTTP_400_BAD_REQUEST)

        MoviCont.objects.bulk_update(
            guardadas,
            ['fecha', 'cuenta', 'doc_ref', 'observacion', 'cedula',
             'centro_costo', 'doc_soporte', 'vr_debitos', 'vr_creditos',
             'updated_by', 'updated_at'],
        )
        return Response({'detail': f'{len(guardadas)} línea(s) actualizada(s).',
                         'ok': True})

    @action(detail=False, methods=['post'], url_path='eliminar')
    def eliminar(self, request):
        cod_comprob = request.data.get('cod_comprob')
        num_comprob = request.data.get('num_comprob')
        if not cod_comprob or num_comprob is None:
            return Response({'detail': 'Faltan cod_comprob y num_comprob.'},
                            status=status.HTTP_400_BAD_REQUEST)
        filas = self.get_queryset().filter(
            cod_comprob__codigo=cod_comprob, num_comprob=num_comprob
        )
        if not filas.exists():
            return Response({'detail': 'No se encontró el movimiento.'},
                            status=status.HTTP_404_NOT_FOUND)
        filas.delete()
        return Response({'detail': 'Movimiento eliminado.'})

    @action(detail=False, methods=['post'], url_path='anular')
    def anular(self, request):
        cod_comprob = request.data.get('cod_comprob')
        num_comprob = request.data.get('num_comprob')
        if not cod_comprob or num_comprob is None:
            return Response({'detail': 'Faltan cod_comprob y num_comprob.'},
                            status=status.HTTP_400_BAD_REQUEST)
        filas = self.get_queryset().filter(
            cod_comprob__codigo=cod_comprob, num_comprob=num_comprob
        )
        if not filas.exists():
            return Response({'detail': 'No se encontró el movimiento.'},
                            status=status.HTTP_404_NOT_FOUND)
        for f in filas:
            valor = f.vr_debitos if f.vr_debitos > 0 else f.vr_creditos
            tipo  = 'VrDb' if f.vr_debitos > 0 else 'VrCr'
            prefijo = f'ANULADO {tipo}.{valor:.2f}'
            nueva_obs = f'{prefijo} {f.observacion}'.strip()[:200]
            f.observacion = nueva_obs
            f.vr_debitos  = 0
            f.vr_creditos = 0
            f.save(update_fields=['observacion', 'vr_debitos', 'vr_creditos'])
        return Response({'detail': 'Movimiento anulado.'})

    @action(detail=False, methods=['post'], url_path='importar')
    def importar(self, request):
        modo      = request.data.get('modo')
        registros = request.data.get('registros')
        if modo not in ('solo_nuevos', 'reemplazar', 'ambos'):
            return Response(
                {'detail': "Modo inválido. Use 'solo_nuevos', 'reemplazar' o 'ambos'."},
                status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(registros, list) or not registros:
            return Response({'detail': 'No se recibieron registros.'},
                            status=status.HTTP_400_BAD_REQUEST)

        comprobantes = {c.codigo: c for c in Comprobante.objects.filter(deleted=False)}
        cuentas      = {c.codigo: c for c in Cuenta.objects.filter(deleted=False)}
        terceros     = {t.cedula: t for t in Tercero.objects.filter(deleted=False)}
        centros      = {c.codigo: c for c in CentroCosto.objects.filter(deleted=False)}

        scope = user_scope(request.user)

        # Existentes incluyendo soft-deleted (para respetar la clave única)
        claves  = set()
        for r in registros:
            try:
                claves.add((str(r.get('cod_comprob', '')).strip(),
                            int(r.get('num_comprob')), int(r.get('item_comprob'))))
            except (TypeError, ValueError):
                continue
        existentes = {}
        if claves:
            for m in MoviCont.all_objects.all():
                k = (str(m.cod_comprob_id), m.num_comprob, m.item_comprob)
                if k in claves:
                    existentes[k] = m

        creados = actualizados = omitidos = 0
        errores = []

        def ref(dato, cod=None, num=None):
            return f"{cod if cod is not None else dato.get('cod_comprob', '')}-{num if num is not None else dato.get('num_comprob', '')}"

        for i, dato in enumerate(registros, start=1):
            errs = []
            try:
                num  = int(dato.get('num_comprob'))  if str(dato.get('num_comprob') or '').strip() else 0
                item = int(dato.get('item_comprob')) if str(dato.get('item_comprob') or '').strip() else 0
            except (TypeError, ValueError):
                errs.append('num_comprob e item_comprob deben ser números')
            cod = str(dato.get('cod_comprob', '')).strip()
            if not cod:
                errs.append('Falta cod_comprob')

            if errs:
                errores.append({'fila': i, 'referencia': ref(dato), 'error': ' | '.join(errs)})
                continue

            comprobante = comprobantes.get(cod)
            if not comprobante:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Comprobante '{cod}' no existe"})
                continue
            if scope['comprobantes'] is not None and cod not in scope['comprobantes']:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Comprobante '{cod}' no está permitido para su rol"})
                continue
            if not comprobante.activo:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Comprobante '{cod}' está inactivo"})
                continue

            cuenta_cod = str(dato.get('cuenta', '')).strip()
            cuenta = cuentas.get(cuenta_cod)
            if not cuenta:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Cuenta '{cuenta_cod}' no existe"})
                continue
            if scope['cuentas'] is not None and cuenta_cod not in scope['cuentas']:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Cuenta '{cuenta_cod}' no está permitida para su rol"})
                continue
            if not (cuenta.es_detalle and cuenta.is_active):
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Cuenta '{cuenta_cod}' no es de detalle o está inactiva"})
                continue

            fecha = _parsear_fecha(dato.get('fecha'))
            if dato.get('fecha') and not fecha:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Fecha inválida: {dato.get('fecha')}"})
                continue

            cedula = str(dato.get('cedula', '') or '').strip()
            tercero = terceros.get(cedula) if cedula else None
            if cedula and not tercero:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Tercero '{cedula}' no existe"})
                continue

            cc_cod = str(dato.get('centro_costo', '') or '').strip()
            cc_obj = centros.get(cc_cod) if cc_cod else None
            if cc_cod and not cc_obj:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Centro de costo '{cc_cod}' no existe"})
                continue
            if scope['centros_costo'] is not None and (not cc_obj or cc_cod not in scope['centros_costo']):
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': f"Centro de costo '{cc_cod or '(vacío)'}' no está permitido para su rol"})
                continue

            try:
                deb = Decimal(str(dato.get('vr_debitos', 0) or 0))
                cre = Decimal(str(dato.get('vr_creditos', 0) or 0))
            except (InvalidOperation, TypeError, ValueError):
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': 'vr_debitos y vr_creditos deben ser numéricos'})
                continue

            doc_ref     = str(dato.get('doc_ref', '') or '').strip()
            observacion = str(dato.get('observacion', '') or '').strip()
            doc_soporte = str(dato.get('doc_soporte', '') or '').strip()
            if len(doc_ref) > 14 or len(doc_soporte) > 15 or len(observacion) > 200:
                errores.append({'fila': i, 'referencia': ref(dato, cod, num),
                                'error': 'doc_ref (14), doc_soporte (15) u observación (200) exceden el máximo'})
                continue

            clave      = (cod, num, item)
            existente  = existentes.get(clave)
            if existente and modo == 'solo_nuevos':
                omitidos += 1
                continue
            if not existente and modo == 'reemplazar':
                omitidos += 1
                continue

            if existente:
                # En actualización solo se sobrescriben campos provistos (no vacíos)
                if not doc_ref:     doc_ref     = existente.doc_ref
                if not observacion: observacion = existente.observacion
                if not doc_soporte: doc_soporte = existente.doc_soporte
                if fecha is None:   fecha       = existente.fecha
            else:
                # Registro nuevo: los campos faltantes se autocompletan
                if not doc_ref:     doc_ref     = '.'
                if not observacion: observacion = '.'
                if not doc_soporte: doc_soporte = '.'
                if fecha is None:   fecha       = date(1900, 1, 1)

            kwargs = dict(
                cod_comprob=comprobante, num_comprob=num, item_comprob=item,
                fecha=fecha, cuenta=cuenta, doc_ref=doc_ref,
                observacion=observacion, cedula=tercero, centro_costo=cc_obj,
                doc_soporte=doc_soporte, vr_debitos=deb, vr_creditos=cre,
            )
            if existente:
                for k, v in kwargs.items():
                    setattr(existente, k, v)
                existente.deleted = False
                existente.deleted_at = None
                existente.deleted_by = None
                existente.updated_by = request.user
                existente.save()
                actualizados += 1
            else:
                MoviCont.objects.create(created_by=request.user, **kwargs)
                creados += 1

        return Response({
            'creados':     creados,
            'actualizados': actualizados,
            'omitidos':    omitidos,
            'errores':     errores,
        })
