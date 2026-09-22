import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.accounting.models import (
    MoviCont, PeriodoContable, EstadoPeriodo, Comprobante, Cuenta
)

logger = logging.getLogger('apps.accounting')


class JournalService:

    @staticmethod
    def validar_partida_doble(lineas: list) -> None:
        if len(lineas) < 2:
            raise ValidationError("Un asiento debe tener al menos 2 líneas.")
        total_deb = sum(Decimal(str(l.get('vr_debitos', 0)))  for l in lineas)
        total_cre = sum(Decimal(str(l.get('vr_creditos', 0))) for l in lineas)
        if total_deb == 0 and total_cre == 0:
            raise ValidationError("El asiento no puede tener todos los valores en cero.")
        diferencia = abs(total_deb - total_cre)
        if diferencia > Decimal('0.01'):
            raise ValidationError(
                f"Partida doble no cuadra. "
                f"Débitos: {total_deb:,.2f} | Créditos: {total_cre:,.2f} | "
                f"Diferencia: {diferencia:,.2f}"
            )

    @staticmethod
    def validar_periodo(fecha) -> PeriodoContable:
        periodo = PeriodoContable.objects.filter(
            fecha_inicio__lte=fecha,
            fecha_fin__gte=fecha,
            deleted=False
        ).first()
        if not periodo:
            raise ValidationError(
                f"No existe período contable para la fecha {fecha}. "
                f"Créelo en Configuración → Períodos."
            )
        if periodo.estado != EstadoPeriodo.ABIERTO:
            raise ValidationError(
                f"El período '{periodo}' está {periodo.get_estado_display()} "
                f"y no acepta nuevos movimientos."
            )
        return periodo

    @staticmethod
    def validar_cuentas(lineas: list) -> None:
        codigos = [str(l['cuenta']) for l in lineas]
        validas = set(
            Cuenta.objects.filter(
                codigo__in=codigos, es_detalle=True, is_active=True, deleted=False
            ).values_list('codigo', flat=True)
        )
        invalidas = set(codigos) - validas
        if invalidas:
            raise ValidationError(
                f"Cuentas inválidas, inactivas o no son de detalle: {', '.join(sorted(invalidas))}"
            )

    @classmethod
    @transaction.atomic
    def crear_movimiento(cls, user, data: dict) -> list:
        """Crea un movimiento contable (grupo de líneas) en la tabla unificada.

        Devuelve las filas MoviCont creadas.
        """
        lineas_data = data.pop('lineas', [])
        cls.validar_partida_doble(lineas_data)
        cls.validar_cuentas(lineas_data)
        cls.validar_periodo(data['fecha'])

        comprobante = Comprobante.objects.select_for_update().get(
            codigo=data['cod_comprob'], deleted=False
        )
        if not comprobante.activo:
            raise ValidationError(f"El comprobante '{comprobante.codigo}' está inactivo.")

        num_comprob = comprobante.next_number()
        doc_ref     = data.get('doc_ref', '')
        doc_soporte = data.get('doc_soporte', '')

        creadas = []
        for i, linea_data in enumerate(lineas_data, start=1):
            cuenta_codigo  = str(linea_data.pop('cuenta'))
            linea_data.pop('item_comprob', None)
            tercero_cedula = linea_data.pop('cedula', None) or linea_data.pop('tercero', None)
            cc_codigo      = linea_data.pop('centro_costo', None)

            cuenta_obj = Cuenta.objects.get(codigo=cuenta_codigo)
            fila_kwargs = dict(
                created_by=user,
                cod_comprob=comprobante,
                num_comprob=num_comprob,
                item_comprob=i,
                fecha=data['fecha'],
                cuenta=cuenta_obj,
                doc_ref=doc_ref,
                doc_soporte=doc_soporte,
                **linea_data,
            )
            if tercero_cedula:
                from apps.accounting.models import Tercero
                t = Tercero.objects.filter(cedula=tercero_cedula).first()
                fila_kwargs['cedula'] = t
            if cc_codigo:
                from apps.accounting.models import CentroCosto
                cc = CentroCosto.objects.filter(codigo=cc_codigo).first()
                fila_kwargs['centro_costo'] = cc

            creadas.append(MoviCont.objects.create(**fila_kwargs))

        cls._auditoria(user, 'CREATE', creadas)
        return creadas

    @staticmethod
    def _auditoria(user, accion, filas):
        try:
            from apps.audit.models import AuditLog
            primera = filas[0]
            AuditLog.objects.create(
                user=user, action=accion,
                resource='MoviCont', resource_id=str(primera.id),
                after_data={
                    'referencia': f"{primera.cod_comprob_id}-{primera.num_comprob:06d}",
                    'fecha': str(primera.fecha),
                    'total_deb': str(sum(f.vr_debitos for f in filas)),
                }
            )
        except Exception:
            logger.warning("No se pudo registrar auditoría para %s", filas[0])
