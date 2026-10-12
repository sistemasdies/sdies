"""
Reportes financieros — usa clase_aptig para clasificar cuentas:
  A = Activo     (códigos 1xxxx)
  P = Pasivo     (códigos 2xxxx)
  T = Patrimonio (códigos 3xxxx)
  I = Ingreso    (códigos 4xxxx)
  G = Gasto      (códigos 5xxxx)
"""
from decimal import Decimal
from django.db.models import Sum
from apps.accounting.models import MoviCont


class ReportService:

    @staticmethod
    def _qs(fecha_desde, fecha_hasta, clase_aptig=None, excluir_cierre=False,
            solo_cuentas=None, solo_centros=None, solo_comprobantes=None):
        qs = MoviCont.objects.filter(
            fecha__gte=fecha_desde,
            fecha__lte=fecha_hasta,
            deleted=False,
        )
        if clase_aptig:
            qs = qs.filter(cuenta__clase_aptig__in=clase_aptig)
        # Alcance por rol (None = sin restricción).
        if solo_cuentas is not None:
            qs = qs.filter(cuenta__codigo__in=solo_cuentas)
        if solo_centros is not None:
            qs = qs.filter(centro_costo__codigo__in=solo_centros)
        if solo_comprobantes is not None:
            qs = qs.filter(cod_comprob__codigo__in=solo_comprobantes)
        if excluir_cierre:
            # Excluye comprobantes de cierre (código empieza por 'z').
            qs = qs.exclude(cod_comprob__codigo__istartswith='z')
        return qs

    @classmethod
    def _saldos_por_clase(cls, fecha_desde, fecha_hasta, clases: list,
                          excluir_cierre=False, solo_cuentas=None, solo_centros=None,
                          solo_comprobantes=None) -> list:
        rows = (
            cls._qs(fecha_desde, fecha_hasta, clase_aptig=clases,
                    excluir_cierre=excluir_cierre,
                    solo_cuentas=solo_cuentas, solo_centros=solo_centros,
                    solo_comprobantes=solo_comprobantes)
            .values('cuenta__codigo', 'cuenta__descripcion',
                    'cuenta__nivel', 'cuenta__naturaleza', 'cuenta__clase_aptig')
            .annotate(deb=Sum('vr_debitos'), cre=Sum('vr_creditos'))
            .order_by('cuenta__codigo')
        )
        result = []
        for r in rows:
            deb   = r['deb'] or Decimal('0')
            cre   = r['cre'] or Decimal('0')
            # Naturaleza D → saldo = deb - cre | Naturaleza C → saldo = cre - deb
            saldo = deb - cre if r['cuenta__naturaleza'] == 'D' else cre - deb
            result.append({
                'codigo':      r['cuenta__codigo'],
                'descripcion': r['cuenta__descripcion'],
                'nivel':       r['cuenta__nivel'],
                'clase':       r['cuenta__clase_aptig'],
                'saldo':       saldo,
            })
        return result

    @classmethod
    def balance_general(cls, fecha_hasta, solo_cuentas=None, solo_centros=None,
                        solo_comprobantes=None) -> dict:
        """
        Balance General (Estado de Situación Financiera).
        Activos vs Pasivos + Patrimonio + Ingresos - Gastos.
        Los parámetros solo_* limitan los datos al alcance del rol del usuario;
        por ello la ecuación contable puede aparecer descuadrada a propósito.
        """
        import datetime
        fecha_inicio = datetime.date(1900, 1, 1)

        alcance = dict(solo_cuentas=solo_cuentas, solo_centros=solo_centros,
                       solo_comprobantes=solo_comprobantes)
        activos    = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['A'], **alcance)
        pasivos    = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['P'], **alcance)
        patrimonio = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['T'], **alcance)
        ingresos_rows = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['I'], **alcance)
        gastos_rows   = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['G'], **alcance)

        total_a = sum(r['saldo'] for r in activos)
        total_p = sum(r['saldo'] for r in pasivos)
        total_t = sum(r['saldo'] for r in patrimonio)
        ingresos = sum(r['saldo'] for r in ingresos_rows)
        gastos   = sum(abs(r['saldo']) for r in gastos_rows)

        diferencia = total_a - (total_p + total_t + ingresos - gastos)

        return {
            'fecha_hasta':    str(fecha_hasta),
            'activos':        activos,
            'pasivos':        pasivos,
            'patrimonio':     patrimonio,
            'ingresos_rows':  ingresos_rows,
            'gastos_rows':    gastos_rows,
            'total_activos':  total_a,
            'total_pasivos':  total_p,
            'total_patrimonio': total_t,
            'ingresos':       ingresos,
            'gastos':         gastos,
            'ecuacion_ok':    abs(diferencia) < 0.01,
            'diferencia':     diferencia,
        }

    @classmethod
    def estado_resultados(cls, fecha_desde, fecha_hasta, excluir_cierre=False,
                          solo_cuentas=None, solo_centros=None,
                          solo_comprobantes=None) -> dict:
        """
        Estado de Resultados (P&G).
        Ingresos (I) vs Gastos (G).
        Si excluir_cierre=True se omiten los comprobantes de cierre (código 'z...').
        Los parámetros solo_* limitan los datos al alcance del rol del usuario.
        """
        ingresos_rows = cls._saldos_por_clase(
            fecha_desde, fecha_hasta, ['I'], excluir_cierre=excluir_cierre,
            solo_cuentas=solo_cuentas, solo_centros=solo_centros,
            solo_comprobantes=solo_comprobantes)
        gastos_rows   = cls._saldos_por_clase(
            fecha_desde, fecha_hasta, ['G'], excluir_cierre=excluir_cierre,
            solo_cuentas=solo_cuentas, solo_centros=solo_centros,
            solo_comprobantes=solo_comprobantes)

        ingresos = sum(r['saldo'] for r in ingresos_rows)
        gastos   = sum(abs(r['saldo']) for r in gastos_rows)
        utilidad = ingresos - gastos

        return {
            'fecha_desde':    str(fecha_desde),
            'fecha_hasta':    str(fecha_hasta),
            'ingresos_rows':  ingresos_rows,
            'gastos_rows':    gastos_rows,
            'ingresos':       ingresos,
            'gastos':         gastos,
            'utilidad':       utilidad,
        }

    @classmethod
    def balance_comprobacion(cls, fecha_desde, fecha_hasta, **kwargs) -> dict:
        """Balance de comprobación — todas las clases."""
        from apps.accounting.services.balance_service import BalanceService
        return BalanceService.balance_comprobacion(fecha_desde, fecha_hasta, **kwargs)