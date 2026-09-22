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
    def _qs(fecha_desde, fecha_hasta, clase_aptig=None):
        qs = MoviCont.objects.filter(
            fecha__gte=fecha_desde,
            fecha__lte=fecha_hasta,
            deleted=False,
        )
        if clase_aptig:
            qs = qs.filter(cuenta__clase_aptig__in=clase_aptig)
        return qs

    @classmethod
    def _saldos_por_clase(cls, fecha_desde, fecha_hasta, clases: list) -> list:
        rows = (
            cls._qs(fecha_desde, fecha_hasta, clase_aptig=clases)
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
    def balance_general(cls, fecha_hasta) -> dict:
        """
        Balance General (Estado de Situación Financiera).
        Activos vs Pasivos + Patrimonio + Ingresos - Gastos.
        """
        import datetime
        fecha_inicio = datetime.date(1900, 1, 1)

        activos    = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['A'])
        pasivos    = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['P'])
        patrimonio = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['T'])
        ingresos_rows = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['I'])
        gastos_rows   = cls._saldos_por_clase(fecha_inicio, fecha_hasta, ['G'])

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
    def estado_resultados(cls, fecha_desde, fecha_hasta) -> dict:
        """
        Estado de Resultados (P&G).
        Ingresos (I) vs Gastos (G).
        """
        ingresos_rows = cls._saldos_por_clase(fecha_desde, fecha_hasta, ['I'])
        gastos_rows   = cls._saldos_por_clase(fecha_desde, fecha_hasta, ['G'])

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
    def balance_comprobacion(cls, fecha_desde, fecha_hasta) -> dict:
        """Balance de comprobación — todas las clases."""
        from apps.accounting.services.balance_service import BalanceService
        return BalanceService.balance_comprobacion(fecha_desde, fecha_hasta)