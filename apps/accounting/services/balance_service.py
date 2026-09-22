from decimal import Decimal
from django.db.models import Sum
from apps.accounting.models import MoviCont, Cuenta, CentroCosto, Tercero


def _naturaleza_saldo(naturaleza, deb, cre, anterior):
    """Nuevo saldo según naturaleza: D → deb-cre, C → cre-deb."""
    if naturaleza == 'D':
        return anterior + (deb - cre)
    return anterior + (cre - deb)


def _padre_codigo(codigo):
    n = len(codigo)
    if n == 2: return codigo[:1]
    if n == 4: return codigo[:2]
    if n == 6: return codigo[:4]
    return ''


class BalanceService:

    @staticmethod
    def saldo_cuenta(codigo: str, fecha_desde=None, fecha_hasta=None) -> dict:
        qs = MoviCont.objects.filter(cuenta__codigo=codigo, deleted=False)
        if fecha_desde: qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta: qs = qs.filter(fecha__lte=fecha_hasta)
        agg = qs.aggregate(deb=Sum('vr_debitos'), cre=Sum('vr_creditos'))
        deb = agg['deb'] or Decimal('0')
        cre = agg['cre'] or Decimal('0')
        return {'debitos': deb, 'creditos': cre, 'saldo': deb - cre}

    # ────────────────────────────────────────────────────────────────
    # Balance de comprobación con jerarquía y filtros
    # ────────────────────────────────────────────────────────────────
    @classmethod
    def balance_comprobacion(cls, fecha_desde, fecha_hasta, libros=None,
                             cuentas=None, centros=None, nivel=4) -> dict:
        libros  = [str(x) for x in (libros or [])]
        cuentas = [str(x) for x in (cuentas or [])]
        centros = [str(x) for x in (centros or [])]
        try:
            nivel = int(nivel)
        except (TypeError, ValueError):
            nivel = 4
        if nivel not in (1, 2, 3, 4, 5, 6):
            nivel = 4

        def _filtros(qs):
            if libros:  qs = qs.filter(cod_comprob__codigo__in=libros)
            if cuentas: qs = qs.filter(cuenta__codigo__in=cuentas)
            if centros: qs = qs.filter(centro_costo__codigo__in=centros)
            return qs

        # ── Agregados finos por (cuenta, centro, cedula) ──────────────
        def _agregar(qs, destino):
            for r in (qs
                      .values('cuenta__codigo', 'centro_costo__codigo', 'cedula__cedula')
                      .annotate(deb=Sum('vr_debitos'), cre=Sum('vr_creditos'))):
                k = (r['cuenta__codigo'], r['centro_costo__codigo'], r['cedula__cedula'])
                vals = destino.setdefault(k, {'deb': Decimal('0'), 'cre': Decimal('0')})
                vals['deb'] += r['deb'] or Decimal('0')
                vals['cre'] += r['cre'] or Decimal('0')

        agg_periodo = {}
        agg_anterior = {}
        _agregar(_filtros(MoviCont.objects.filter(
            fecha__gte=fecha_desde, fecha__lte=fecha_hasta, deleted=False)), agg_periodo)
        _agregar(_filtros(MoviCont.objects.filter(
            fecha__lt=fecha_desde, deleted=False)), agg_anterior)

        # Cuentas involucradas (período + anterior)
        cuenta_cods = set()
        for k in agg_periodo:  cuenta_cods.add(k[0])
        for k in agg_anterior: cuenta_cods.add(k[0])
        if not cuenta_cods:
            return {'rows': [], 'totales': None}

        cuentas_obj = {c.codigo: c for c in Cuenta.objects.filter(deleted=False)}
        naturaleza = {c.codigo: (c.naturaleza or 'D') for c in cuentas_obj.values()}
        clase_ap   = {c.codigo: c.clase_aptig for c in cuentas_obj.values()}

        centro_desc = {c.codigo: c.descripcion
                       for c in CentroCosto.objects.filter(deleted=False)}
        tercero_desc = {t.cedula: t.nombre_completo
                        for t in Tercero.objects.filter(deleted=False)}

        # ── Totales por cuenta ──
        def _por_cuenta(fuente):
            d = {}
            for (c, _, _), v in fuente.items():
                d[c] = d.get(c, (Decimal('0'), Decimal('0')))
                d[c] = (d[c][0] + v['deb'], d[c][1] + v['cre'])
            return d

        cuenta_p = _por_cuenta(agg_periodo)
        cuenta_a = _por_cuenta(agg_anterior)

        # ── Detalle anidado: cuenta → centro → cédula ──
        def _build_detalle(fuente):
            """cuenta -> {centro(None permitido): {total:(deb,cre), cedulas:{ced:(deb,cre)}}}"""
            d = {}
            for (c, ct, ce), v in fuente.items():
                ctd = d.setdefault(c, {}).setdefault(
                    ct, {'total': (Decimal('0'), Decimal('0')), 'cedulas': {}})
                ctd['total'] = (ctd['total'][0] + v['deb'], ctd['total'][1] + v['cre'])
                if ce:
                    ced = ctd['cedulas'].get(ce, (Decimal('0'), Decimal('0')))
                    ctd['cedulas'][ce] = (ced[0] + v['deb'], ced[1] + v['cre'])
            return d

        detalle_p = _build_detalle(agg_periodo)
        detalle_a = _build_detalle(agg_anterior)

        # ── Árbol de cuentas (1→2→4→6 dígitos = niveles 1-4) ──
        all_cods = set(cuenta_cods)
        for c in list(all_cods):
            p = _padre_codigo(c)
            while p:
                all_cods.add(p)
                p = _padre_codigo(p)

        hijos = {}
        for c in all_cods:
            p = _padre_codigo(c)
            if p:
                hijos.setdefault(p, []).append(c)

        def _es_hoja(c):
            return not hijos.get(c)

        # Descripción de una cuenta (incluso si es ancestro sin movimiento)
        def _desc_cuenta(cuenta):
            if cuenta in cuentas_obj:
                return cuentas_obj[cuenta].descripcion
            return f"Código {cuenta}"

        rows = []

        def _push(tipo, codigo, descripcion, nat, nivel_row, es_padre,
                  a_deb, a_cre, p_deb, p_cre, clase=''):
            anterior = _naturaleza_saldo(nat, a_deb, a_cre, Decimal('0'))
            nuevo    = _naturaleza_saldo(nat, p_deb, p_cre, anterior)
            rows.append({
                'tipo': tipo, 'codigo': codigo, 'descripcion': descripcion,
                'nivel': str(nivel_row), 'clase': clase or clase_ap.get(codigo, ''),
                'anterior': anterior, 'debitos': p_deb, 'creditos': p_cre,
                'saldo': nuevo, 'es_padre': es_padre,
            })

        def _acumular_arbol(cuenta):
            a_deb, a_cre = cuenta_a.get(cuenta, (Decimal('0'), Decimal('0')))
            p_deb, p_cre = cuenta_p.get(cuenta, (Decimal('0'), Decimal('0')))
            for h in hijos.get(cuenta, []):
                ha, hc, hp, hcre = _acumular_arbol(h)
                a_deb += ha; a_cre += hc; p_deb += hp; p_cre += hcre
            return a_deb, a_cre, p_deb, p_cre

        def _emitir_cuenta(cuenta, prof):
            nat = naturaleza.get(cuenta, 'D')
            clase = clase_ap.get(cuenta, '')
            if not _es_hoja(cuenta):
                # Renglón padre: acumula todo su sub-árbol
                a_deb, a_cre, p_deb, p_cre = _acumular_arbol(cuenta)
                _push('cuenta', cuenta, _desc_cuenta(cuenta), nat, prof, True,
                      a_deb, a_cre, p_deb, p_cre, clase=clase)
                for h in sorted(hijos[cuenta]):
                    _emitir_cuenta(h, prof + 1)
            else:
                _emitir_detalle(cuenta, nat, prof, clase)

        def _emitir_detalle(cuenta, nat, prof, clase=''):
            # Renglón de cuenta: siempre presente
            a_deb, a_cre = cuenta_a.get(cuenta, (Decimal('0'), Decimal('0')))
            p_deb, p_cre = cuenta_p.get(cuenta, (Decimal('0'), Decimal('0')))
            _push('cuenta', cuenta, _desc_cuenta(cuenta), nat, prof, False,
                  a_deb, a_cre, p_deb, p_cre, clase=clase)

            if nivel >= 5:
                centros_p = detalle_p.get(cuenta, {})
                centros_a = detalle_a.get(cuenta, {})
                centros = sorted((set(centros_p) | set(centros_a)) - {None}, key=str)
                hay_sin_centro = (None in centros_p) or (None in centros_a)

                for cct in centros:
                    a_parte = centros_a.get(cct, {'total': (Decimal('0'), Decimal('0')), 'cedulas': {}})
                    p_parte = centros_p.get(cct, {'total': (Decimal('0'), Decimal('0')), 'cedulas': {}})
                    a_tot, p_tot = a_parte['total'], p_parte['total']
                    _push('centro', cct, centro_desc.get(cct, cct), nat, 5, False,
                          a_tot[0], a_tot[1], p_tot[0], p_tot[1], clase=clase)

                    if nivel >= 6:
                        _emitir_cedulas(cct, a_parte, p_parte, nat,
                                        a_tot, p_tot, clase)

                if hay_sin_centro:
                    a_parte = centros_a.get(None, {'total': (Decimal('0'), Decimal('0')), 'cedulas': {}})
                    p_parte = centros_p.get(None, {'total': (Decimal('0'), Decimal('0')), 'cedulas': {}})
                    a_tot, p_tot = a_parte['total'], p_parte['total']
                    _push('centro', 'SIN', 'Sin centro de costo', nat, 5, False,
                          a_tot[0], a_tot[1], p_tot[0], p_tot[1], clase=clase)
                    if nivel >= 6:
                        _emitir_cedulas(None, a_parte, p_parte, nat,
                                        a_tot, p_tot, clase)

        def _emitir_cedulas(centro, a_parte, p_parte, nat, a_tot, p_tot, clase=''):
            ced_a = a_parte['cedulas']
            ced_p = p_parte['cedulas']
            cedulas = sorted(set(ced_a) | set(ced_p), key=str)
            for ced in cedulas:
                a_ = ced_a.get(ced, (Decimal('0'), Decimal('0')))
                p_ = ced_p.get(ced, (Decimal('0'), Decimal('0')))
                _push('cedula', ced, tercero_desc.get(ced, ced), nat, 6, False,
                      a_[0], a_[1], p_[0], p_[1], clase=clase)
            # Fila "sin tercero" dentro de este centro
            a_suma = (sum(v[0] for v in ced_a.values()), sum(v[1] for v in ced_a.values()))
            p_suma = (sum(v[0] for v in ced_p.values()), sum(v[1] for v in ced_p.values()))
            sin_a = (a_tot[0] - a_suma[0], a_tot[1] - a_suma[1])
            sin_p = (p_tot[0] - p_suma[0], p_tot[1] - p_suma[1])
            if sin_a[0] or sin_a[1] or sin_p[0] or sin_p[1]:
                _push('cedula', 'SIN', 'Sin tercero', nat, 6, False,
                      sin_a[0], sin_a[1], sin_p[0], sin_p[1], clase=clase)

        # ── Emitir el árbol desde las raíces ──
        for raiz in sorted(c for c in all_cods if not _padre_codigo(c)):
            _emitir_cuenta(raiz, 1)

        # ── Totales generales (todas las cuentas de movimiento) ──
        def _sum_dict(dic):
            deb = sum(v[0] for v in dic.values())
            cre = sum(v[1] for v in dic.values())
            return deb, cre

        t_a_deb, t_a_cre = _sum_dict(cuenta_a)
        t_p_deb, t_p_cre = _sum_dict(cuenta_p)
        totales = {
            'anterior': t_a_deb - t_a_cre,
            'debitos':  t_p_deb,
            'creditos': t_p_cre,
            'saldo':    (t_a_deb + t_p_deb) - (t_a_cre + t_p_cre),
        }
        return {'rows': rows, 'totales': totales}