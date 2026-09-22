from decimal import Decimal

from django.db.models import Sum

from apps.accounting.models import MoviCont

CAMPOS_ORDEN = {'cuenta', 'fecha', 'cedula', 'centro_costo'}
CERO = Decimal('0')


def _str(v):
    """Formatea un valor (Decimal/float) con dos decimales exactos."""
    if v is None:
        return '0.00'
    return format(v, '.2f')


def _neto(codigo, deb, cre):
    """Saldo según la naturaleza de la cuenta.

    Cuentas de naturaleza crédito (principio 2, 3, 4): saldo = créditos − débitos.
    Las demás (activos, gastos, costos): saldo = débitos − créditos.
    """
    if str(codigo or '')[0] in '234':
        return cre - deb
    return deb - cre


def auxiliares(fecha_desde, fecha_hasta, cuentas=(), centros=(), comprobantes=(),
               cedulas=(), orden1='fecha', orden2='cuenta', orden3='cedula',
               saldos_iniciales=False, subtotales_cedula=False,
               solo_cuentas=None, solo_centros=None, solo_comprobantes=None) -> dict:
    """Reporte de auxiliares (MoviCont) agrupado por cuenta.

    - Cada cuenta es un grupo; se muestra su descripción como subtítulo.
    - Opcional: subtotales por cédula dentro de cada cuenta.
    - Opcional: saldo inicial = Σ débitos − Σ créditos antes de fecha_desde,
      calculado por cuenta (o por cuenta+cédula con subtotales por cédula).
    - Orden dentro de cada grupo según 3 campos elegidos.
    - `solo_*`: códigos permitidos por el rol (None = sin restricción).
    """
    qs = MoviCont.objects.filter(deleted=False)
    if cuentas:      qs = qs.filter(cuenta__codigo__in=cuentas)
    if centros:      qs = qs.filter(centro_costo__codigo__in=centros)
    if comprobantes: qs = qs.filter(cod_comprob__codigo__in=comprobantes)
    if cedulas:      qs = qs.filter(cedula__in=cedulas)
    if fecha_desde:  qs = qs.filter(fecha__gte=fecha_desde)
    if fecha_hasta:  qs = qs.filter(fecha__lte=fecha_hasta)
    if solo_cuentas is not None:
        qs = qs.filter(cuenta__codigo__in=solo_cuentas)
    if solo_centros is not None:
        qs = qs.filter(centro_costo__codigo__in=solo_centros)
    if solo_comprobantes is not None:
        qs = qs.filter(cod_comprob__codigo__in=solo_comprobantes)

    filas = list(qs.select_related(
        'cuenta', 'cedula', 'centro_costo', 'cod_comprob').order_by('fecha'))

    # Saldos iniciales por (cuenta, cédula) — mismos filtros pero fecha < desde
    saldos_ini = {}
    if saldos_iniciales and fecha_desde:
        qs_ini = MoviCont.objects.filter(deleted=False, fecha__lt=fecha_desde)
        if cuentas:      qs_ini = qs_ini.filter(cuenta__codigo__in=cuentas)
        if centros:      qs_ini = qs_ini.filter(centro_costo__codigo__in=centros)
        if comprobantes: qs_ini = qs_ini.filter(cod_comprob__codigo__in=comprobantes)
        if cedulas:      qs_ini = qs_ini.filter(cedula__in=cedulas)
        if solo_cuentas is not None:
            qs_ini = qs_ini.filter(cuenta__codigo__in=solo_cuentas)
        if solo_centros is not None:
            qs_ini = qs_ini.filter(centro_costo__codigo__in=solo_centros)
        if solo_comprobantes is not None:
            qs_ini = qs_ini.filter(cod_comprob__codigo__in=solo_comprobantes)
        for r in qs_ini.values('cuenta__codigo', 'cedula').annotate(
                deb=Sum('vr_debitos'), cre=Sum('vr_creditos')):
            key = (r['cuenta__codigo'], r['cedula'] or '')
            saldos_ini[key] = _neto(r['cuenta__codigo'], r['deb'] or CERO, r['cre'] or CERO)

    notas = {
        'cuenta':       lambda f: f.cuenta_id or '',
        'fecha':        lambda f: f.fecha or '',
        'cedula':       lambda f: f.cedula_id or '',
        'centro_costo': lambda f: f.centro_costo_id or '',
    }
    elegidos = [o for o in (orden1, orden2, orden3) if o in CAMPOS_ORDEN]

    if subtotales_cedula:
        orden_ef = ['cedula'] + [o for o in elegidos if o != 'cedula']
    else:
        orden_ef = elegidos

    filas.sort(key=lambda f: tuple(notas[c](f) for c in orden_ef))

    # Agrupar por cuenta (sin perder el objeto Cuenta)
    grupos = {}
    for f in filas:
        grupos.setdefault(f.cuenta_id, {'cuenta': f.cuenta, 'filas': []})['filas'].append(f)

    total_deb = CERO
    total_cre = CERO
    resultado_cuentas = []

    for codigo in sorted(grupos):
        cuenta = grupos[codigo]['cuenta']
        rows   = grupos[codigo]['filas']
        if subtotales_cedula:
            saldo_ini_cuenta = sum(
                saldos_ini.get((codigo, c), CERO)
                for c in {f.cedula_id or '' for f in rows})
        else:
            saldo_ini_cuenta = sum(
                v for (cod, _c), v in saldos_ini.items() if cod == codigo)

        deb = sum((f.vr_debitos for f in rows), CERO)
        cre = sum((f.vr_creditos for f in rows), CERO)

        detalle = []
        placas  = []

        if subtotales_cedula:
            actual = None
            ini_bloque = deb_bloque = cre_bloque = CERO
            for f in rows:
                c = f.cedula_id or ''
                if c != actual:
                    if actual is not None:
                        placas.append(_bloque((codigo, actual), detalle, ini_bloque,
                                              deb_bloque, cre_bloque))
                    actual = c
                    ini_bloque = saldos_ini.get((codigo, c), CERO)
                    deb_bloque = cre_bloque = CERO
                deb_bloque += f.vr_debitos
                cre_bloque += f.vr_creditos
                saldo = ini_bloque + _neto(codigo, deb_bloque, cre_bloque)
                detalle.append(row_dict(f, saldo))
            placas.append(_bloque((codigo, actual), detalle, ini_bloque,
                                  deb_bloque, cre_bloque))
        else:
            saldo = saldo_ini_cuenta
            for f in rows:
                saldo += _neto(codigo, f.vr_debitos, f.vr_creditos)
                detalle.append(row_dict(f, saldo))

        total_deb += deb
        total_cre += cre

        resultado_cuentas.append({
            'codigo':           codigo,
            'descripcion':      cuenta.descripcion,
            'saldo_inicial':    _str(saldo_ini_cuenta),
            'subtotal_debitos': _str(deb),
            'subtotal_creditos': _str(cre),
            'subtotal_saldo':   _str(saldo_ini_cuenta + _neto(codigo, deb, cre)),
            'filas':            detalle,
            'cedulas':          placas if subtotales_cedula else [],
        })

    return {
        'fecha_desde':       fecha_desde.isoformat() if fecha_desde else None,
        'fecha_hasta':       fecha_hasta.isoformat() if fecha_hasta else None,
        'saldos_iniciales':  saldos_iniciales,
        'subtotales_cedula': subtotales_cedula,
        'orden':             [o for o in (orden1, orden2, orden3)],
        'cuentas':           resultado_cuentas,
        'total_debitos':     _str(total_deb),
        'total_creditos':    _str(total_cre),
    }


def _bloque(key, detalle, ini, deb, cre):
    tercero = detalle[-1].get('tercero_nombre') if detalle else ''
    return {
        'cedula':           key[1],
        'tercero_nombre':   tercero,
        'saldo_inicial':    _str(ini),
        'subtotal_debitos': _str(deb),
        'subtotal_creditos': _str(cre),
        'subtotal_saldo':   _str(ini + _neto(key[0], deb, cre)),
    }


def _nombre_corto(tercero):
    """Primer apellido + primer nombre (o razón social), con trim."""
    if not tercero:
        return ''
    if tercero.razon_social:
        return ' '.join(tercero.razon_social.split())
    return ' '.join((tercero.apellido1 or '', tercero.nombre1 or '')).strip()


def row_dict(f, saldo):
    return {
        'cod_comprob':    f.cod_comprob_id,
        'num_comprob':    f.num_comprob,
        'item_comprob':   f.item_comprob,
        'fecha':          f.fecha.isoformat(),
        'cedula':         f.cedula_id or '',
        'tercero_nombre': f.cedula.nombre_completo if f.cedula else '',
        'apellido_nombre': _nombre_corto(f.cedula) if f.cedula else '',
        'centro_costo':   f.centro_costo_id or '',
        'cc_descripcion': f.centro_costo.descripcion if f.centro_costo else '',
        'observacion':    f.observacion,
        'doc_ref':        f.doc_ref,
        'debito':         _str(f.vr_debitos),
        'credito':        _str(f.vr_creditos),
        'saldo':          _str(saldo),
    }