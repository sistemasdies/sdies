from celery import shared_task
import logging
logger = logging.getLogger('apps.reports')

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generar_reporte_pdf(self, tipo_reporte, fecha_desde, fecha_hasta, email):
    try:
        from apps.reports.services.balance_sheet import ReportService
        if tipo_reporte   == 'balance_general':
            data = ReportService.balance_general(fecha_hasta)
        elif tipo_reporte == 'estado_resultados':
            data = ReportService.estado_resultados(fecha_desde, fecha_hasta)
        else:
            from apps.accounting.services.balance_service import BalanceService
            data = BalanceService.balance_comprobacion(fecha_desde, fecha_hasta)
        logger.info("PDF %s → %s", tipo_reporte, email)
        return {'status': 'ok', 'tipo': tipo_reporte, 'email': email}
    except Exception as exc:
        raise self.retry(exc=exc)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generar_reporte_excel(self, tipo_reporte, fecha_desde, fecha_hasta, email):
    try:
        logger.info("Excel %s → %s", tipo_reporte, email)
        return {'status': 'ok', 'tipo': tipo_reporte, 'email': email}
    except Exception as exc:
        raise self.retry(exc=exc)
