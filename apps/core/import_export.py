"""Utilidades genéricas para importación/exportación masiva de datos maestros."""
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response


def importar_masivo(
    registros,
    modelo,
    serializer_class,
    campo_clave,
    request,
    extraer_clave=None,
    transformar_payload=None,
    prefiltro_qs=None,
    save_kwargs_create=None,
    save_kwargs_update=None,
):
    """
    Importación masiva genérica con modo solo_nuevos / reemplazar / ambos.

    Parámetros:
    - registros: list[dict] con los datos a importar.
    - modelo: clase del modelo Django.
    - serializer_class: serializer DRF para validar/guardar.
    - campo_clave: str, nombre del campo único en el modelo (ej: 'codigo').
    - request: Request actual (para created_by/updated_by).
    - extraer_clave: callable opcional para extraer la clave de un registro.
    - transformar_payload: callable opcional para ajustar cada registro antes
      de pasarlo al serializer.
    - prefiltro_qs: queryset opcional para restringir la búsqueda de existentes.

    Retorna Response con { creados, actualizados, omitidos, errores }.
    """
    if not isinstance(registros, list) or not registros:
        return Response(
            {'detail': 'No se recibieron registros.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    modo = request.data.get('modo', 'solo_nuevos')
    if modo not in ('solo_nuevos', 'reemplazar', 'ambos'):
        return Response(
            {'detail': "Modo inválido. Use: 'solo_nuevos', 'reemplazar' o 'ambos'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if extraer_clave is None:
        def extraer_clave(r):
            return str(r.get(campo_clave, '')).strip()

    if transformar_payload is None:
        def transformar_payload(r):
            return r

    claves = [extraer_clave(r) for r in registros if extraer_clave(r)]
    qs = modelo.objects.all()
    if prefiltro_qs is not None:
        qs = prefiltro_qs
    if hasattr(modelo, 'deleted'):
        qs = qs.filter(deleted=False)

    existentes = {
        str(getattr(obj, campo_clave)): obj
        for obj in qs.filter(**{f'{campo_clave}__in': claves})
    }

    creados = actualizados = omitidos = 0
    errores = []

    with transaction.atomic():
        for i, dato in enumerate(registros, start=1):
            clave = extraer_clave(dato)
            if not clave:
                errores.append({'fila': i, 'clave': '', 'error': f'Falta {campo_clave}'})
                continue

            existente = existentes.get(clave)
            if existente and modo == 'solo_nuevos':
                omitidos += 1
                continue
            if not existente and modo == 'reemplazar':
                omitidos += 1
                continue

            payload = transformar_payload(dict(dato))
            # Asegurar que el campo clave venga en el payload
            payload[campo_clave] = clave

            context = {'request': request}
            serializer = serializer_class(
                instance=existente,
                data=payload,
                partial=True,
                context=context,
            )
            if serializer.is_valid():
                if existente:
                    kwargs = save_kwargs_update or {}
                    serializer.save(**kwargs)
                    actualizados += 1
                else:
                    kwargs = save_kwargs_create or {}
                    serializer.save(**kwargs)
                    creados += 1
            else:
                msgs = '; '.join(f'{k}: {v[0]}' for k, v in serializer.errors.items())
                errores.append({'fila': i, 'clave': clave, 'error': msgs})

    return Response({
        'creados': creados,
        'actualizados': actualizados,
        'omitidos': omitidos,
        'errores': errores,
    })
