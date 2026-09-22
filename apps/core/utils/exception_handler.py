import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError

logger = logging.getLogger('apps')


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if isinstance(exc, DjangoValidationError):
        return Response(
            {'detail': exc.messages if hasattr(exc, 'messages') else str(exc)},
            status=status.HTTP_400_BAD_REQUEST
        )

    if isinstance(exc, IntegrityError):
        logger.warning("IntegrityError: %s", exc)
        return Response(
            {'detail': 'Error de integridad en los datos. Verifique que no haya duplicados.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if response is not None:
        data = response.data
        if isinstance(data, dict):
            detail = data.get('detail')
            if detail is None and 'non_field_errors' in data:
                msgs = data['non_field_errors']
                detail = msgs[0] if isinstance(msgs, list) and msgs else str(msgs)
            if detail is None:
                # Errores por campo: {responsable: ["..."], codigo: ["..."]}
                for key, val in data.items():
                    if isinstance(val, list) and val:
                        detail = f"{key}: {val[0]}"
                        break
                if detail is None:
                    detail = str(data)
        else:
            detail = str(data)
        response.data = {'detail': detail}
    else:
        logger.exception("Error no manejado", exc_info=exc)
        return Response(
            {'detail': 'Error interno del servidor.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    return response
