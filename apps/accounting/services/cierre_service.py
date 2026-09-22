import logging
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.accounting.models import (
    PeriodoContable, EstadoPeriodo, CierrePeriodoContable, MoviCont
)

logger = logging.getLogger('apps.accounting')


class CierreService:

    @classmethod
    @transaction.atomic
    def cerrar_periodo(cls, periodo: PeriodoContable, user, notas: str = '') -> PeriodoContable:
        if not periodo.esta_abierto:
            raise ValidationError(f"El período '{periodo}' no está abierto.")

        periodo.estado = EstadoPeriodo.EN_CIERRE
        periodo.save(update_fields=['estado', 'updated_at'])

        lineas = MoviCont.objects.filter(
            fecha__gte=periodo.fecha_inicio,
            fecha__lte=periodo.fecha_fin,
            deleted=False
        ).select_related('cuenta', 'cedula', 'centro_costo')

        snapshots = [
            CierrePeriodoContable(
                periodo=periodo, created_by=user,
                cod_comprob=l.cod_comprob_id,
                num_comprob=l.num_comprob,
                item_comprob=l.item_comprob,
                fecha=l.fecha,
                cuenta=l.cuenta_id,
                doc_ref=l.doc_ref, observacion=l.observacion,
                cedula=l.cedula_id or '',
                centro_costo=l.centro_costo_id or '',
                vr_debitos=l.vr_debitos, vr_creditos=l.vr_creditos,
            ) for l in lineas
        ]
        CierrePeriodoContable.objects.bulk_create(snapshots, batch_size=500)

        periodo.estado       = EstadoPeriodo.CERRADO
        periodo.cerrado_por  = user
        periodo.fecha_cierre = timezone.now()
        periodo.notas_cierre = notas
        periodo.save(update_fields=['estado','cerrado_por','fecha_cierre','notas_cierre','updated_at'])

        logger.info("Período %s cerrado por %s — %d líneas en snapshot", periodo, user, len(snapshots))
        return periodo
