"""Reporte comparativo de 12 periodos móviles sobre MoviCont.

Dos agrupaciones, elegidas con `agrupacion`:
  - 'mes'  -> los 12 meses que arrancan en el periodo recibido (YYYY-MM).
              Cruza el año si hace falta: enero -> enero..diciembre del mismo
              año; marzo -> marzo..febrero del año siguiente.
  - 'anio' -> los 12 años que arrancan en el año recibido (YYYY).

Signo por naturaleza del código de cuenta (primer dígito):
  - 1 (Activo)   y 5 (Gasto)      -> debitos - creditos
  - 2 (Pasivo), 3 (Patrimonio) y 4 (Ingreso) -> creditos - debitos

Al pie se acumulan por separado los ingresos (clase 4) y los gastos (clase 5),
y el Superávit / Déficit es Ingresos - Gastos.

Cada celda es el acumulado del periodo para el conjunto de cuentas
seleccionable. El detalle por tercero es opcional y cuelga debajo del renglón
de la cuenta, sumando exactamente a su renglón (incluye un renglón SIN por
movimientos sin cédula, para que la cuenta nunca descuadre).
"""
import calendar
import datetime
from decimal import Decimal

from django.db.models import Sum, Q

from apps.accounting.models import Cuenta, MoviCont, Tercero

CERO = Decimal('0')
CLASES_PERMITIDAS = ('4', '5')
MESES = ('Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
         'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic')
TOTAL_COLUMNAS = 12


class PeriodoInvalido(ValueError):
    """El texto recibido no es un mes (YYYY-MM) ni un año (YYYY) válido."""


def _str(v):
    if v is None:
        return '0.00'
    return format(v, '.2f')


def _naturaleza(codigo):
    """'D' para clases 1 y 5; 'C' para las clases 2, 3 y 4."""
    return 'D' if str(codigo or '')[:1] in ('1', '5') else 'C'


def _saldo(naturaleza, deb, cre):
    return deb - cre if naturaleza == 'D' else cre - deb


def _rango_periodos(inicio, agrupacion):
    """Las 12 claves de periodo, en orden: (año, mes) o (año,)."""
    texto = (inicio or '').strip()
    if agrupacion == 'anio':
        try:
            anio = int(texto[:4])
        except (ValueError, AttributeError, TypeError):
            raise PeriodoInvalido(
                f"Año inválido: '{inicio}'. Use el formato YYYY.")
        return [(anio + i,) for i in range(TOTAL_COLUMNAS)]
    try:
        anio, mes = (int(x) for x in texto.split('-')[:2])
        if not 1 <= mes <= 12:
            raise ValueError
    except (ValueError, AttributeError, TypeError):
        raise PeriodoInvalido(
            f"Mes inválido: '{inicio}'. Use el formato YYYY-MM.")
    periodos = []
    a, m = anio, mes
    for _ in range(TOTAL_COLUMNAS):
        periodos.append((a, m))
        m += 1
        if m > 12:
            m, a = 1, a + 1
    return periodos


def _limites(periodos, agrupacion):
    """Fechas extremas del rango y rótulos de cada columna."""
    primero, ultimo = periodos[0], periodos[-1]
    if agrupacion == 'anio':
        a_ini, a_fin = primero[0], ultimo[0]
        return (datetime.date(a_ini, 1, 1), datetime.date(a_fin, 12, 31),
                [str(p[0]) for p in periodos], [''] * TOTAL_COLUMNAS,
                f'{a_ini:04d}', f'{a_fin:04d}', 'Total 12 años')
    a_ini, m_ini = primero
    a_fin, m_fin = ultimo
    return (datetime.date(a_ini, m_ini, 1),
            datetime.date(a_fin, m_fin, calendar.monthrange(a_fin, m_fin)[1]),
            [MESES[p[1] - 1] for p in periodos],
            [str(p[0]) for p in periodos],
            f'{a_ini:04d}-{m_ini:02d}', f'{a_fin:04d}-{m_fin:02d}',
            'Total 12 meses')


def _expandir_cuentas(cuentas):
    """Códigos seleccionados más todos sus descendientes (jerarquía por prefijo)."""
    if not cuentas:
        return []
    return list({c for cod in cuentas for c in Cuenta.objects.filter(
        deleted=False, codigo__startswith=str(cod)).values_list('codigo', flat=True)})


def comparativo_meses(inicio, cuentas=(), centros=(), comprobantes=(), cedulas=(),
                      detalle_terceros=False, solo_cuentas=None,
                      solo_centros=None, solo_comprobantes=None,
                      agrupacion='mes') -> dict:
    """Acumulado de 12 periodos por cuenta, con el total de los 12 periodos."""

    agrupacion = 'anio' if agrupacion == 'anio' else 'mes'
    periodos = _rango_periodos(inicio, agrupacion)
    indices = {p: i for i, p in enumerate(periodos)}
    (fecha_desde, fecha_hasta, etiquetas, subetiquetas,
     inicio_iso, fin_iso, etiqueta_total) = _limites(periodos, agrupacion)

    qs = MoviCont.objects.filter(
        deleted=False, fecha__gte=fecha_desde, fecha__lte=fecha_hasta)

    # Cuentas a considerar: las elegidas (con descendientes) o las de clase I y G.
    alcance = _expandir_cuentas(cuentas)
    if alcance:
        qs = qs.filter(cuenta__codigo__in=alcance)
    else:
        q = Q()
        for clase in CLASES_PERMITIDAS:
            q |= Q(cuenta__codigo__startswith=clase)
        qs = qs.filter(q)

    if centros:      qs = qs.filter(centro_costo__codigo__in=centros)
    if comprobantes: qs = qs.filter(cod_comprob__codigo__in=comprobantes)
    if cedulas:      qs = qs.filter(cedula__in=cedulas)
    if solo_cuentas is not None:      qs = qs.filter(cuenta__codigo__in=solo_cuentas)
    if solo_centros is not None:      qs = qs.filter(centro_costo__codigo__in=solo_centros)
    if solo_comprobantes is not None: qs = qs.filter(cod_comprob__codigo__in=solo_comprobantes)

    # Una sola consulta: cuenta x cedula x (año [x mes]).
    dims = ['cuenta__codigo', 'cedula__cedula', 'fecha__year']
    if agrupacion == 'mes':
        dims.append('fecha__month')
    movs = {}
    for r in (qs.values(*dims).annotate(deb=Sum('vr_debitos'), cre=Sum('vr_creditos'))):
        clave = (r['fecha__year'], r['fecha__month']) if agrupacion == 'mes' else (r['fecha__year'],)
        i = indices.get(clave)
        if i is None:
            continue
        movs.setdefault((r['cuenta__codigo'], r['cedula__cedula']),
                        [(CERO, CERO)] * TOTAL_COLUMNAS)[i] = (r['deb'] or CERO, r['cre'] or CERO)

    descripciones = {c.codigo: c.descripcion for c in Cuenta.objects.filter(
        deleted=False, codigo__in={k[0] for k in movs})}
    nombres = {}
    if detalle_terceros:
        nombres = {t.cedula: t.nombre_completo for t in Tercero.objects.filter(
            deleted=False, cedula__in={k[1] for k in movs if k[1]})}

    # ── Renglones de cuenta (y sus terceros, si se piden) ────────────────
    filas = []
    ingresos = [CERO] * TOTAL_COLUMNAS
    gastos = [CERO] * TOTAL_COLUMNAS
    otros = [CERO] * TOTAL_COLUMNAS
    for codigo in sorted({k[0] for k in movs}):
        nat = _naturaleza(codigo)
        propios = {ced: movs[(codigo, ced)] for (c, ced) in movs if c == codigo}

        valores = [CERO] * TOTAL_COLUMNAS
        for ced in sorted(propios, key=lambda x: (x is None, str(x))):
            for i, (deb, cre) in enumerate(propios[ced]):
                valores[i] += _saldo(nat, deb, cre)
        suma = sum(valores, CERO)

        if not suma:
            continue  # renglón en cero: se omite

        fila = {
            'tipo': 'cuenta',
            'codigo': codigo,
            'descripcion': descripciones.get(codigo, f'Código {codigo}'),
            'naturaleza': nat,
            'clase': codigo[:1],
            'valores': [_str(v) for v in valores],
            'total': _str(suma),
            'terceros': [],
        }

        if detalle_terceros:
            for ced in sorted(propios, key=lambda x: (x is None, str(x))):
                v_terc = [_saldo(nat, deb, cre) for deb, cre in propios[ced]]
                if not sum(v_terc, CERO):
                    continue  # tercero en cero: se omite
                fila['terceros'].append({
                    'tipo': 'tercero',
                    'cedula': ced or '',
                    'descripcion': ('Sin tercero' if not ced
                                     else nombres.get(ced, ced)),
                    'valores': [_str(v) for v in v_terc],
                    'total': _str(sum(v_terc, CERO)),
                })

        filas.append(fila)
        destino = ingresos if fila['clase'] == '4' else gastos if fila['clase'] == '5' else otros
        for i, v in enumerate(valores):
            destino[i] += v

    # Superávit / Déficit = Ingresos - Gastos (+ otras clases, si se filtraron).
    superavit = [ingresos[i] - gastos[i] + otros[i] for i in range(TOTAL_COLUMNAS)]
    # Ingresos primero, luego gastos y al final las demás clases.
    orden_clase = {'4': 0, '5': 1}
    filas.sort(key=lambda f: (orden_clase.get(f['clase'], 2), f['codigo']))
    return {
        'agrupacion': agrupacion,
        'inicio': inicio_iso,
        'inicio_iso': inicio_iso,
        'fin_iso': fin_iso,
        'fecha_desde': fecha_desde.isoformat(),
        'fecha_hasta': fecha_hasta.isoformat(),
        'etiquetas': etiquetas,
        'subetiquetas': subetiquetas,
        'etiqueta_total_periodo': etiqueta_total,
        'filas': filas,
        'total_ingresos': [_str(v) for v in ingresos],
        'total_ingresos_periodo': _str(sum(ingresos, CERO)),
        'total_gastos': [_str(v) for v in gastos],
        'total_gastos_periodo': _str(sum(gastos, CERO)),
        'total_otros': [_str(v) for v in otros],
        'total_otros_periodo': _str(sum(otros, CERO)),
        'superavit': [_str(v) for v in superavit],
        'superavit_periodo': _str(sum(superavit, CERO)),
    }